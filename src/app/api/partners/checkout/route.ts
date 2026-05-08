import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
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

    // Create Stripe Checkout Session with 7-day trial
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_STANDARD_PRICE_ID!,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          vendor_id: vendor.id,
          user_id: user.id,
        },
      },
      success_url: `${appUrl}/partners/dashboard?onboarding=1`,
      cancel_url: `${appUrl}/partners/checkout?canceled=1`,
      metadata: {
        vendor_id: vendor.id,
        user_id: user.id,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Partner checkout error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}


