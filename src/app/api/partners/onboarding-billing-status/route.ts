import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { subscriptionTierFromStripePriceId } from '@/lib/stripe-partner-plans'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

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

async function reconcileCheckoutFromStripe(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  vendor: {
    id: string
    stripe_customer_id: string | null
  }
) {
  if (!vendor.stripe_customer_id) return null

  const subscriptions = await stripe.subscriptions.list({
    customer: vendor.stripe_customer_id,
    status: 'all',
    limit: 10,
  })

  const subscription = subscriptions.data.find((sub) => {
    const statusOk = ['trialing', 'active', 'past_due'].includes(sub.status)
    const vendorMatches = !sub.metadata?.vendor_id || sub.metadata.vendor_id === vendor.id
    return statusOk && vendorMatches
  })

  if (!subscription) return null

  const stripePriceId = subscription.items.data[0]?.price.id ?? ''
  const subscriptionTier =
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
  }).eq('id', vendor.id)

  await admin.from('vendor_subscriptions').upsert({
    vendor_id: vendor.id,
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

  return {
    status: vendorStatus,
    stripe_checkout_completed: true,
  }
}

/** GET — client polls during partner onboarding billing step (session + vendor flags). */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        email_verified: false,
        vendor_status: null as string | null,
        stripe_checkout_completed: false,
      })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id, email_verified, status, stripe_checkout_completed, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let reconciled: { status: string; stripe_checkout_completed: boolean } | null = null
    if (
      vendor?.email_verified &&
      !vendor.stripe_checkout_completed &&
      vendor.stripe_customer_id
    ) {
      reconciled = await reconcileCheckoutFromStripe(admin, {
        id: vendor.id,
        stripe_customer_id: vendor.stripe_customer_id,
      })
    }

    return NextResponse.json({
      authenticated: true,
      email_verified: Boolean(vendor?.email_verified),
      vendor_status: reconciled?.status ?? ((vendor?.status as string | null) ?? null),
      stripe_checkout_completed:
        reconciled?.stripe_checkout_completed ?? Boolean(vendor?.stripe_checkout_completed),
    })
  } catch (err) {
    console.error('[onboarding-billing-status]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
