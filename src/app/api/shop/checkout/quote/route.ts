import { resolveApiUser } from '@/lib/api-auth-user'
import { isKillSwitchActive, killSwitchResponse } from '@/lib/kill-switch'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { shopCheckoutBodySchema } from '@/lib/shop/checkout-schema'
import { CheckoutPricingError, resolveShopCheckoutPricing } from '@/lib/shop/checkout-pricing'
import { loadPublishedShopProduct } from '@/lib/shop/checkout'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const QUOTE_LIMIT = 30

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

/** Preview item + shipping + tax totals before PaymentSheet (no PI created). */
export async function POST(request: NextRequest) {
  if (isKillSwitchActive()) return killSwitchResponse('/api/shop/checkout/quote')

  try {
    const user = await resolveApiUser(request)
    if (!user?.id) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    const key = getRateLimitKey(request, user.id)
    const rl = consumeRateLimit(`shop-checkout-quote:${key}`, QUOTE_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    const parsed = shopCheckoutBodySchema.safeParse(await request.json())
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const loaded = await loadPublishedShopProduct(admin, parsed.data.product_id)
    if (!loaded) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const { product, vendor } = loaded
    if (product.quantity < 1) {
      return NextResponse.json({ error: 'Out of stock' }, { status: 409 })
    }

    const pricing = await resolveShopCheckoutPricing(admin, stripe, parsed.data, vendor, product)
    return NextResponse.json({
      itemSubtotalCad: pricing.itemSubtotalCad,
      shippingCad: pricing.shippingCad,
      taxCad: pricing.taxCad,
      totalCad: pricing.totalCad,
    })
  } catch (e) {
    if (e instanceof CheckoutPricingError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('shop checkout quote POST', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
