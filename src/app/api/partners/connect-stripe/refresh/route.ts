import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

// GET /api/partners/connect-stripe/refresh — regenerate expired onboarding link
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(`${APP_URL}/partners/login`)
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.redirect(`${APP_URL}/partners/dashboard`)
    }

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id, stripe_account_id')
      .eq('user_id', user.id)
      .single()

    if (!vendor?.stripe_account_id) {
      return NextResponse.redirect(`${APP_URL}/partners/dashboard`)
    }

    const accountLink = await stripe.accountLinks.create({
      account: vendor.stripe_account_id,
      refresh_url: `${APP_URL}/api/partners/connect-stripe/refresh`,
      return_url: `${APP_URL}/partners/dashboard?connect=success`,
      type: 'account_onboarding',
    })

    return NextResponse.redirect(accountLink.url)
  } catch (err) {
    console.error('Stripe Connect refresh error:', err)
    return NextResponse.redirect(`${APP_URL}/partners/dashboard`)
  }
}


