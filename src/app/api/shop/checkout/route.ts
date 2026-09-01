import { resolveApiUser } from '@/lib/api-auth-user'
import { customerTaxAddressFromPostal } from '@/lib/canadian-postal-province'
import { isKillSwitchActive, killSwitchResponse } from '@/lib/kill-switch'
import { logSecurityEvent } from '@/lib/security-monitor'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { estimateCanadianStripeFee } from '@/lib/stripe-charge-fees'
import { getOrCreateStripeCustomerId } from '@/lib/stripe-consumer-customer'
import { calculateShopOrderTax } from '@/lib/stripe-shop-tax'
import { shopPlatformFeeCents } from '@/lib/shop/fees'
import { shopCheckoutBodySchema } from '@/lib/shop/checkout-schema'
import {
  loadPublishedShopProduct,
  shopHighValueFlags,
  vendorShipFromAddress,
} from '@/lib/shop/checkout'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const CHECKOUT_LIMIT = 15

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

export async function POST(request: NextRequest) {
  if (isKillSwitchActive()) return killSwitchResponse('/api/shop/checkout')

  try {
    const user = await resolveApiUser(request)
    if (!user?.id || !user.email) {
      return NextResponse.json({ error: 'Sign in required to purchase.' }, { status: 401 })
    }

    const key = getRateLimitKey(request, user.id)
    const rl = consumeRateLimit(`shop-checkout:${key}`, CHECKOUT_LIMIT)
    if (!rl.allowed) {
      logSecurityEvent('warn', { type: 'rate_limited', route: '/api/shop/checkout', ipKey: key })
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    const raw = await request.json()
    const parsed = shopCheckoutBodySchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const body = parsed.data
    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const loaded = await loadPublishedShopProduct(admin, body.product_id)
    if (!loaded) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const { product, vendor } = loaded
    if (product.quantity < 1) {
      return NextResponse.json({ error: 'Out of stock' }, { status: 409 })
    }

    const itemSubtotalCad = product.price_cad
    const highValue = shopHighValueFlags(itemSubtotalCad)
    const handlingFee = Number(vendor.shipping_handling_fee_cad ?? 0)

    let shippingCad = 0
    let shippoRateId: string | null = null
    let shippoShipmentId: string | null = null

    if (body.fulfillment_type === 'pickup') {
      if (!product.pickup_available || !vendor.shop_pickup_enabled) {
        return NextResponse.json({ error: 'Pickup is not available for this item' }, { status: 422 })
      }
    } else {
      if (!body.ship_address) {
        return NextResponse.json({ error: 'Shipping address required' }, { status: 422 })
      }
      if (!body.shippo_rate_id || !body.shippo_shipment_id || body.shippo_rate_amount_cad == null) {
        return NextResponse.json({ error: 'Select a shipping rate' }, { status: 422 })
      }

      const shipFrom = vendorShipFromAddress(vendor)
      if (!shipFrom) {
        return NextResponse.json({ error: 'Seller shipping address is not configured' }, { status: 422 })
      }

      shippingCad = Math.round((body.shippo_rate_amount_cad + handlingFee) * 100) / 100
      shippoRateId = body.shippo_rate_id
      shippoShipmentId = body.shippo_shipment_id
    }

    const customerTaxAddr =
      body.fulfillment_type === 'ship' && body.ship_address
        ? customerTaxAddressFromPostal(body.ship_address.postal_code, {
            state: body.ship_address.province,
            city: body.ship_address.city,
            line1: body.ship_address.line1,
          })
        : null

    if (!customerTaxAddr) {
      return NextResponse.json({ error: 'Valid Canadian shipping address required' }, { status: 422 })
    }

    let taxBreakdown
    try {
      taxBreakdown = await calculateShopOrderTax(stripe, {
        itemSubtotalCad,
        shippingCad,
        customerAddress: customerTaxAddr,
        reference: `shop_product_${product.id}`,
      })
    } catch (taxErr) {
      console.error('Shop tax calculation error:', taxErr)
      const detail = taxErr instanceof Stripe.errors.StripeError ? taxErr.message : undefined
      return NextResponse.json(
        { error: detail ?? 'Could not calculate tax for this order.' },
        { status: 422 }
      )
    }

    const platformFeeCents = shopPlatformFeeCents(Math.round(itemSubtotalCad * 100))
    const estimatedStripeFeeCents = Math.min(
      taxBreakdown.amountTotalCents,
      Math.max(0, Math.round(estimateCanadianStripeFee(taxBreakdown.totalCad).feeCad * 100))
    )

    let applicationFeeAmount = platformFeeCents + estimatedStripeFeeCents

    try {
      const connectedAccount = await stripe.accounts.retrieve(vendor.stripe_account_id!)
      const feePayer = connectedAccount.controller?.fees?.payer
      if (feePayer === 'account') {
        applicationFeeAmount = platformFeeCents
      }
    } catch {
      /* keep combined fee */
    }

    let stripeCustomerId: string
    try {
      stripeCustomerId = await getOrCreateStripeCustomerId(admin, stripe, user.id, user.email)
    } catch (e) {
      console.error('Stripe customer for shop checkout:', e)
      return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: taxBreakdown.amountTotalCents,
      currency: 'cad',
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      on_behalf_of: vendor.stripe_account_id!,
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: vendor.stripe_account_id!,
      },
      customer: stripeCustomerId,
      setup_future_usage: 'off_session',
      metadata: {
        order_type: 'shop',
        product_id: product.id,
        vendor_id: vendor.id,
        user_id: user.id,
        buyer_name: body.buyer_name,
        buyer_email: body.buyer_email,
        fulfillment_type: body.fulfillment_type,
        item_subtotal_cad: String(itemSubtotalCad),
        shipping_cad: String(shippingCad),
        tax_cad: String(taxBreakdown.taxCad),
        total_cad: String(taxBreakdown.totalCad),
        tax_calculation: taxBreakdown.calculationId,
        platform_fee_cents: String(platformFeeCents),
        estimated_stripe_fee_cents: String(estimatedStripeFeeCents),
        shippo_rate_id: shippoRateId ?? '',
        shippo_shipment_id: shippoShipmentId ?? '',
        requires_signature: String(highValue.requires_signature),
        requires_insurance: String(highValue.requires_insurance),
        ship_by_business_days: String(product.ship_by_business_days),
        ship_to_name: body.ship_address?.name ?? '',
        ship_to_line1: body.ship_address?.line1 ?? '',
        ship_to_line2: body.ship_address?.line2 ?? '',
        ship_to_city: body.ship_address?.city ?? '',
        ship_to_province: body.ship_address?.province ?? '',
        ship_to_postal_code: body.ship_address?.postal_code ?? '',
      },
      description: `${vendor.business_name ?? 'Maker'} — ${product.title}`,
      receipt_email: body.buyer_email,
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      itemSubtotalCad,
      shippingCad,
      taxCad: taxBreakdown.taxCad,
      totalCad: taxBreakdown.totalCad,
      platformFeeCad: platformFeeCents / 100,
      shipByBusinessDays: product.ship_by_business_days,
      madeToOrder: product.made_to_order,
      highValue,
    })
  } catch (err) {
    console.error('shop checkout POST', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
