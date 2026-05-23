import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

// GET /api/partners/connect-stripe/refresh — regenerate expired onboarding link
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  const appUrl = `${proto}://${host}`

  try {

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(`${appUrl}/partners/login`)
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.redirect(`${appUrl}/partners/dashboard`)
    }

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id, stripe_account_id')
      .eq('user_id', user.id)
      .single()

    if (!vendor?.stripe_account_id) {
      return NextResponse.redirect(`${appUrl}/partners/dashboard`)
    }

    const accountLink = await stripe.accountLinks.create({
      account: vendor.stripe_account_id,
      refresh_url: `${appUrl}/api/partners/connect-stripe/refresh`,
      return_url: `${appUrl}/partners/dashboard?connect=success`,
      type: 'account_onboarding',
    })

    return NextResponse.redirect(accountLink.url)
  } catch (err) {
    console.error('Stripe Connect refresh error:', err)
    return NextResponse.redirect(`${appUrl}/partners/dashboard`)
  }
}


