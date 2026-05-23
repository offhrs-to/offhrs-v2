import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { subscriptionTierFromStripePriceId } from '@/lib/stripe-partner-plans'
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

function parsePartnerSubscriptionTier(value: unknown): 'lite' | 'pro' | null {
  return value === 'lite' || value === 'pro' ? value : null
}

function stripeStatusToVendorStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'trialing': return 'trialing'
    case 'active': return 'active'
    case 'past_due': return 'past_due'
    case 'canceled': return 'canceled'
    case 'unpaid': return 'suspended'
    default: return 'past_due'
  }
}

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request)
  const fallbackUrl = `${appUrl}/partners/signup?billing=1`

  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    if (!sessionId) {
      return NextResponse.redirect(`${fallbackUrl}&checkout_error=missing_session`)
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(`${appUrl}/partners/login`)
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.redirect(`${fallbackUrl}&checkout_error=server_config`)
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.mode !== 'subscription' || !session.subscription) {
      return NextResponse.redirect(`${fallbackUrl}&checkout_error=invalid_session`)
    }

    const vendorId = session.metadata?.vendor_id
    const sessionUserId = session.metadata?.user_id
    if (!vendorId || sessionUserId !== user.id) {
      return NextResponse.redirect(`${fallbackUrl}&checkout_error=unauthorized_session`)
    }

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id, user_id')
      .eq('id', vendorId)
      .maybeSingle()

    if (!vendor || vendor.user_id !== user.id) {
      return NextResponse.redirect(`${fallbackUrl}&checkout_error=vendor_mismatch`)
    }

    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription.id
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)

    const stripePriceId = subscription.items.data[0]?.price.id ?? ''
    const subscriptionTier =
      parsePartnerSubscriptionTier(session.metadata?.plan) ??
      parsePartnerSubscriptionTier(subscription.metadata?.plan) ??
      subscriptionTierFromStripePriceId(stripePriceId)
    const vendorStatus = stripeStatusToVendorStatus(subscription.status)

    await admin.from('vendor_profiles').update({
      status: vendorStatus,
      stripe_checkout_completed: true,
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      subscription_current_period_end: subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
        : null,
    }).eq('id', vendorId)

    await admin.from('vendor_subscriptions').upsert({
      vendor_id: vendorId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: stripePriceId,
      subscription_tier: subscriptionTier,
      status: subscription.status,
      trial_start: subscription.trial_start
        ? new Date(subscription.trial_start * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      current_period_start: subscription.items.data[0]?.current_period_start
        ? new Date(subscription.items.data[0].current_period_start * 1000).toISOString()
        : null,
      current_period_end: subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'stripe_subscription_id' })

    return NextResponse.redirect(`${appUrl}/partners/dashboard?onboarding=1`)
  } catch (err) {
    console.error('[partners checkout success]', err)
    return NextResponse.redirect(`${fallbackUrl}&checkout_error=sync_failed`)
  }
}
