import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { PARTNER_TRIAL_DAYS } from '@/lib/partner-pricing'
import {
  stripePriceIdForCheckoutPlan,
  type PartnerCheckoutPlan,
} from '@/lib/stripe-partner-plans'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

const checkoutBodySchema = z.object({
  plan: z.enum(['lite', 'pro']).optional(),
})

function getAppUrl(request: NextRequest): string {
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  if (host) return `${proto}://${host}`

  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

export async function POST(request: NextRequest) {
  try {
    const appUrl = getAppUrl(request)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const rawJson = await request.json().catch(() => ({}))
    const parsedBody = checkoutBodySchema.safeParse(rawJson)
    const plan: PartnerCheckoutPlan = parsedBody.success && parsedBody.data.plan ? parsedBody.data.plan : 'pro'

    let priceId: string
    try {
      priceId = stripePriceIdForCheckoutPlan(plan)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Billing is not configured'
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    // Fetch vendor profile
    const { data: vendor, error: vendorError } = await admin
      .from('vendor_profiles')
      .select('id, business_name, stripe_customer_id, email_verified, status')
      .eq('user_id', user.id)
      .single()

    if (vendorError || !vendor) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    }

    if (!vendor.email_verified) {
      return NextResponse.json({ error: 'Please verify your email first' }, { status: 403 })
    }

    if (vendor.status !== 'pending') {
      return NextResponse.json({ error: 'Subscription already exists' }, { status: 409 })
    }

    // Create or retrieve Stripe customer
    let customerId = vendor.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: vendor.business_name,
        metadata: {
          vendor_id: vendor.id,
          user_id: user.id,
        },
      })
      customerId = customer.id

      await admin
        .from('vendor_profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', vendor.id)
    }

    // Subscription Checkout: 1 month trial, then charge the selected plan monthly.
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      automatic_tax: { enabled: true },
      billing_address_collection: 'required',
      // tax_id_collection requires Stripe to be able to update the customer's
      // business name; otherwise Checkout 400s for any existing customer.
      customer_update: { address: 'auto', name: 'auto' },
      tax_id_collection: { enabled: true },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: PARTNER_TRIAL_DAYS,
        metadata: {
          vendor_id: vendor.id,
          user_id: user.id,
          plan,
        },
      },
      success_url: `${appUrl}/partners/dashboard?onboarding=1`,
      cancel_url: `${appUrl}/partners/signup?billing=1&canceled=1`,
      metadata: {
        vendor_id: vendor.id,
        user_id: user.id,
        plan,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      console.error('Partner checkout Stripe error:', err.message, err.param, err.code)
      return NextResponse.json(
        {
          error:
            err.message ||
            'Stripe rejected this checkout request. Check that STRIPE_PRO_PRICE_ID / STRIPE_LITE_PRICE_ID are recurring subscription prices for the same mode (test/live) as STRIPE_SECRET_KEY.',
        },
        { status: 400 }
      )
    }
    if (err instanceof Stripe.errors.StripeError) {
      console.error('Partner checkout Stripe error:', err.type, err.message)
      return NextResponse.json(
        { error: err.message || 'Stripe error while creating checkout session.' },
        { status: 502 }
      )
    }
    console.error('Partner checkout error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
