import { resolveApiUser } from '@/lib/api-auth-user'
import { isKillSwitchActive, killSwitchResponse } from '@/lib/kill-switch'
import { logSecurityEvent } from '@/lib/security-monitor'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { getOrCreateStripeCustomerId } from '@/lib/stripe-consumer-customer'
import { shopCheckoutBodySchema } from '@/lib/shop/checkout-schema'
import { CheckoutPricingError, resolveShopCheckoutPricing } from '@/lib/shop/checkout-pricing'
import { loadPublishedShopProduct } from '@/lib/shop/checkout'
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

    let pricing
    try {
      pricing = await resolveShopCheckoutPricing(admin, stripe, body, vendor, product)
    } catch (e) {
      if (e instanceof CheckoutPricingError) {
        return NextResponse.json({ error: e.message }, { status: e.status })
      }
      throw e
    }

    let stripeCustomerId: string
    try {
      stripeCustomerId = await getOrCreateStripeCustomerId(admin, stripe, user.id, user.email)
    } catch (e) {
      console.error('Stripe customer for shop checkout:', e)
      return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 })
    }

    let paymentIntent: Stripe.PaymentIntent
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: pricing.amountTotalCents,
        currency: 'cad',
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        on_behalf_of: vendor.stripe_account_id!,
        ...(pricing.applicationFeeAmount > 0
          ? { application_fee_amount: pricing.applicationFeeAmount }
          : {}),
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
          item_subtotal_cad: String(pricing.itemSubtotalCad),
          shipping_cad: String(pricing.shippingCad),
          tax_cad: String(pricing.taxCad),
          total_cad: String(pricing.totalCad),
          tax_calculation: pricing.taxCalculationId,
          platform_fee_cents: String(pricing.platformFeeCents),
          estimated_stripe_fee_cents: String(pricing.estimatedStripeFeeCents),
          shippo_rate_id: pricing.shippoRateId ?? '',
          shippo_shipment_id: pricing.shippoShipmentId ?? '',
          requires_signature: String(pricing.highValue.requires_signature),
          requires_insurance: String(pricing.highValue.requires_insurance),
          ship_by_business_days: String(pricing.shipByBusinessDays),
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
    } catch (piErr) {
      console.error('Shop PaymentIntent create error:', piErr)
      const detail =
        piErr instanceof Stripe.errors.StripeError
          ? piErr.message
          : piErr instanceof Error
            ? piErr.message
            : 'Could not start payment'
      return NextResponse.json({ error: detail }, { status: 422 })
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      itemSubtotalCad: pricing.itemSubtotalCad,
      shippingCad: pricing.shippingCad,
      taxCad: pricing.taxCad,
      totalCad: pricing.totalCad,
      platformFeeCad: pricing.platformFeeCents / 100,
      shipByBusinessDays: pricing.shipByBusinessDays,
      madeToOrder: pricing.madeToOrder,
      highValue: pricing.highValue,
    })
  } catch (err) {
    console.error('shop checkout POST', err)
    const detail =
      err instanceof Stripe.errors.StripeError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Internal server error'
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
