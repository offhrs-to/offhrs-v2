import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

const bodySchema = z.object({
  code: z.string().trim().min(1).max(64),
})

/**
 * POST /api/partners/apply-promo-code
 * Attach a Stripe Promotion Code to the vendor's existing subscription
 * without changing plan/price (bypasses Customer Portal's "update plan" gate).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Enter a promotion code.' }, { status: 400 })
    }
    const code = parsed.data.code.trim()

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id, stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (!vendor?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found.' }, { status: 404 })
    }

    const { data: subRow } = await admin
      .from('vendor_subscriptions')
      .select('stripe_subscription_id, status')
      .eq('vendor_id', vendor.id)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let subscriptionId = (subRow?.stripe_subscription_id as string | null) ?? null

    if (!subscriptionId) {
      const list = await stripe.subscriptions.list({
        customer: vendor.stripe_customer_id,
        status: 'all',
        limit: 10,
      })
      const live = list.data.find((s) =>
        ['trialing', 'active', 'past_due'].includes(s.status)
      )
      subscriptionId = live?.id ?? null
    }

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription found. Start or renew your plan first.' },
        { status: 404 }
      )
    }

    const promoList = await stripe.promotionCodes.list({
      code,
      active: true,
      limit: 1,
    })
    const promo = promoList.data[0]
    if (!promo) {
      return NextResponse.json(
        {
          error:
            'That promotion code is invalid or inactive. Use the customer-facing code from Stripe (not the coupon ID).',
        },
        { status: 400 }
      )
    }

    if (promo.customer && promo.customer !== vendor.stripe_customer_id) {
      return NextResponse.json(
        { error: 'This promotion code is not available for your account.' },
        { status: 403 }
      )
    }

    try {
      const updated = await stripe.subscriptions.update(subscriptionId, {
        discounts: [{ promotion_code: promo.id }],
        proration_behavior: 'none',
      })

      return NextResponse.json({
        ok: true,
        message:
          'Promotion code applied. Your plan is unchanged — the discount will appear on your next invoice.',
        subscription_id: updated.id,
        promotion_code: promo.code,
      })
    } catch (err) {
      if (err instanceof Stripe.errors.StripeInvalidRequestError) {
        return NextResponse.json(
          { error: err.message || 'Stripe could not apply this code to your subscription.' },
          { status: 400 }
        )
      }
      throw err
    }
  } catch (err) {
    console.error('Apply promo code error:', err)
    return NextResponse.json({ error: 'Could not apply promotion code.' }, { status: 500 })
  }
}
