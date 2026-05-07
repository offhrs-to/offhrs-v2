import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil',
})

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

// POST /api/partners/connect-stripe — create Stripe Connect Express account + return onboarding URL
export async function POST(_request: NextRequest) {
  try {
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
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'CA',
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
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
      refresh_url: `${APP_URL}/api/partners/connect-stripe/refresh`,
      return_url: `${APP_URL}/partners/dashboard?connect=success`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    console.error('Stripe Connect error:', err)
    return NextResponse.json({ error: 'Failed to create Stripe Connect account' }, { status: 500 })
  }
}
