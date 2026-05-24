import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

// POST /api/partners/connect-stripe — create Stripe Connect Express account + return onboarding URL
export async function POST(request: NextRequest) {
  try {
    // Build redirect URLs from the request host/protocol (prevents DEPLOYMENT_NOT_FOUND
    // when NEXT_PUBLIC_APP_URL points to the wrong Vercel project/domain).
    const url = new URL(request.url)
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host
    const proto =
      request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
    const appUrl = `${proto}://${host}`

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id, business_name, stripe_account_id, stripe_connect_completed')
      .eq('user_id', user.id)
      .single()

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    if (vendor.stripe_connect_completed) {
      return NextResponse.json({ error: 'Stripe Connect already completed' }, { status: 409 })
    }

    let accountId = vendor.stripe_account_id

    if (!accountId) {
      // Express dashboard: Stripe REQUIRES `fees.payer = application` and
      // `losses.payments = application`. Specifying any other combination with
      // `stripe_dashboard.type = express` returns:
      //   "When stripe_dashboard[type]=express, your platform must collect
      //    fees and be liable for negative balances or refunds and chargebacks."
      // Vendors still effectively absorb processing fees: each PaymentIntent
      // (see src/app/api/book/route.ts) attaches an application_fee_amount
      // equal to the estimated Stripe processing fee, which routes that
      // amount back to the platform and out of the vendor payout.
      const account = await stripe.accounts.create({
        country: 'CA',
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        controller: {
          fees: { payer: 'application' },
          losses: { payments: 'application' },
          requirement_collection: 'stripe',
          stripe_dashboard: { type: 'express' },
        },
        business_profile: {
          name: vendor.business_name,
          product_description: 'Workshop and creative class sessions',
          mcc: '7911', // Dance halls & studios (closest fit for workshops)
        },
        metadata: {
          vendor_id: vendor.id,
          user_id: user.id,
        },
      })

      accountId = account.id

      await admin
        .from('vendor_profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', vendor.id)
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/api/partners/connect-stripe/refresh`,
      return_url: `${appUrl}/partners/dashboard?connect=success`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    console.error('Stripe Connect error:', err)
    return NextResponse.json({ error: 'Failed to create Stripe Connect account' }, { status: 500 })
  }
}


