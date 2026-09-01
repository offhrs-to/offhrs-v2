/**
 * POST /api/shop/checkout/confirm
 * Called after Stripe PaymentSheet succeeds. Creates shop_order and decrements inventory.
 */
import { resolveApiUser } from '@/lib/api-auth-user'
import { isKillSwitchActive, killSwitchResponse } from '@/lib/kill-switch'
import { logSecurityEvent } from '@/lib/security-monitor'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { commitShopTaxTransaction } from '@/lib/stripe-shop-tax'
import { shopConfirmBodySchema } from '@/lib/shop/checkout-schema'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export const maxDuration = 60

const CONFIRM_LIMIT = 20

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

export async function POST(request: NextRequest) {
  if (isKillSwitchActive()) return killSwitchResponse('/api/shop/checkout/confirm')

  try {
    const user = await resolveApiUser(request)
    if (!user?.id) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    const key = getRateLimitKey(request, user.id)
    const rl = consumeRateLimit(`shop-confirm:${key}`, CONFIRM_LIMIT)
    if (!rl.allowed) {
      logSecurityEvent('warn', { type: 'rate_limited', route: '/api/shop/checkout/confirm', ipKey: key })
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    const raw = await request.json()
    const parsed = shopConfirmBodySchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { paymentIntentId } = parsed.data
    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { data: existing } = await admin
      .from('shop_orders')
      .select('id, status')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: true, order_id: existing.id, already_confirmed: true })
    }

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (pi.metadata?.order_type !== 'shop') {
      return NextResponse.json({ error: 'Invalid payment' }, { status: 400 })
    }
    if (pi.metadata?.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (pi.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 402 })
    }

    const productId = pi.metadata.product_id
    const vendorId = pi.metadata.vendor_id
    if (!productId || !vendorId) {
      return NextResponse.json({ error: 'Invalid payment metadata' }, { status: 400 })
    }

    const { data: product } = await admin
      .from('shop_products')
      .select('id, title, price_cad, quantity, status')
      .eq('id', productId)
      .maybeSingle()

    if (!product || product.status !== 'published' || product.quantity < 1) {
      return NextResponse.json(
        { error: 'Product is no longer available. Contact support for a refund.' },
        { status: 409 }
      )
    }

    const fulfillmentType = pi.metadata.fulfillment_type === 'pickup' ? 'pickup' : 'ship'
    const itemSubtotalCad = Number(pi.metadata.item_subtotal_cad)
    const shippingCad = Number(pi.metadata.shipping_cad ?? 0)
    const taxCad = Number(pi.metadata.tax_cad ?? 0)
    const totalCad = Number(pi.metadata.total_cad ?? 0)
    const taxCalculationId = pi.metadata.tax_calculation ?? ''

    const { data: order, error: insertErr } = await admin
      .from('shop_orders')
      .insert({
        user_id: user.id,
        vendor_id: vendorId,
        product_id: productId,
        status: 'paid_awaiting_fulfillment',
        fulfillment_type: fulfillmentType,
        buyer_name: pi.metadata.buyer_name ?? '',
        buyer_email: pi.metadata.buyer_email ?? user.email ?? '',
        ship_to_name: pi.metadata.ship_to_name || null,
        ship_to_line1: pi.metadata.ship_to_line1 || null,
        ship_to_line2: pi.metadata.ship_to_line2 || null,
        ship_to_city: pi.metadata.ship_to_city || null,
        ship_to_province: pi.metadata.ship_to_province || null,
        ship_to_postal_code: pi.metadata.ship_to_postal_code || null,
        ship_to_country: 'CA',
        product_title: product.title,
        product_price_cad: Number(product.price_cad),
        quantity: 1,
        item_subtotal_cad: itemSubtotalCad,
        shipping_collected_cad: shippingCad,
        tax_cad: taxCad,
        total_cad: totalCad,
        platform_fee_cents: Number(pi.metadata.platform_fee_cents ?? 0),
        estimated_stripe_fee_cents: Number(pi.metadata.estimated_stripe_fee_cents ?? 0),
        postage_held: fulfillmentType === 'ship',
        shippo_shipment_id: pi.metadata.shippo_shipment_id || null,
        shippo_rate_id: pi.metadata.shippo_rate_id || null,
        shippo_rate_amount_cad: fulfillmentType === 'ship' ? shippingCad : null,
        requires_signature: pi.metadata.requires_signature === 'true',
        requires_insurance: pi.metadata.requires_insurance === 'true',
        ship_by_business_days: Number(pi.metadata.ship_by_business_days ?? 5),
        stripe_payment_intent_id: paymentIntentId,
        stripe_tax_calculation_id: taxCalculationId || null,
        paid_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertErr) {
      if (insertErr.code === '23505') {
        const { data: dup } = await admin
          .from('shop_orders')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle()
        return NextResponse.json({ success: true, order_id: dup?.id, already_confirmed: true })
      }
      console.error('shop order insert', insertErr)
      return NextResponse.json({ error: 'Could not create order' }, { status: 500 })
    }

    const { data: decremented, error: decErr } = await admin
      .from('shop_products')
      .update({ quantity: product.quantity - 1 })
      .eq('id', productId)
      .eq('quantity', product.quantity)
      .select('id')
      .maybeSingle()

    if (decErr || !decremented) {
      console.error('shop inventory decrement failed', decErr)
    }

    if (taxCalculationId) {
      try {
        await commitShopTaxTransaction(stripe, {
          calculationId: taxCalculationId,
          reference: `shop_order_${order.id}`,
        })
      } catch (taxErr) {
        console.error('shop tax commit failed', taxErr)
      }
    }

    return NextResponse.json({ success: true, order_id: order.id })
  } catch (err) {
    console.error('shop checkout confirm POST', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
