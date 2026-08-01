import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SettingsClient } from './SettingsClient'
import Stripe from 'stripe'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

function fromUnixSeconds(value: number | null | undefined): string | null {
  return value ? new Date(value * 1000).toISOString() : null
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/partners/login')

  const admin = createAdminClient()
  if (!admin) return <div className="p-8 text-red-500">Server configuration error</div>

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select(
      'id, business_name, bio, website_url, instagram_handle, phone, location_address, refund_window_hours, strict_no_refund, status, subscription_current_period_end, stripe_customer_id, gst_hst_registered, gst_hst_registration_number'
    )
    .eq('user_id', user.id)
    .single()

  if (!vendor) redirect('/partners/signup')

  // Pull the latest Stripe subscription mirror so the page can reflect a
  // pending cancellation (cancel_at_period_end) before Stripe's
  // customer.subscription.deleted event flips vendor_profiles.status to
  // 'canceled'. Without this the Settings UI claims the plan still renews
  // even after the vendor cancels in the billing portal.
  const { data: subscription } = await admin
    .from('vendor_subscriptions')
    .select('stripe_subscription_id, cancel_at_period_end, status, current_period_end')
    .eq('vendor_id', vendor.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let subscriptionState = {
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    status: (subscription?.status as string | null) ?? null,
    currentPeriodEnd:
      (subscription?.current_period_end as string | null) ??
      vendor.subscription_current_period_end ??
      null,
  }

  // Webhooks can be delayed or blocked on protected preview deployments. When
  // Settings loads after a Stripe portal return, reconcile directly against
  // Stripe so the dashboard immediately reflects a cancellation request.
  try {
    let stripeSubscription: Stripe.Subscription | null = null
    const stripeSubscriptionId = (subscription?.stripe_subscription_id as string | null | undefined) ?? null
    if (stripeSubscriptionId) {
      stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
    } else if (vendor.stripe_customer_id) {
      const list = await stripe.subscriptions.list({
        customer: vendor.stripe_customer_id,
        status: 'all',
        limit: 1,
      })
      stripeSubscription = list.data[0] ?? null
    }

    if (stripeSubscription) {
      const item = stripeSubscription.items.data[0]
      const cancellationRequested =
        stripeSubscription.cancel_at_period_end ||
        Boolean(
          stripeSubscription.cancel_at &&
          stripeSubscription.cancellation_details?.reason === 'cancellation_requested' &&
          !stripeSubscription.ended_at
        )
      subscriptionState = {
        cancelAtPeriodEnd: cancellationRequested,
        status: stripeSubscription.status,
        currentPeriodEnd:
          fromUnixSeconds(stripeSubscription.cancel_at) ??
          fromUnixSeconds(item?.current_period_end) ??
          subscriptionState.currentPeriodEnd,
      }

      if (stripeSubscriptionId) {
        await admin
          .from('vendor_subscriptions')
          .update({
            status: stripeSubscription.status,
            current_period_start: fromUnixSeconds(item?.current_period_start),
            current_period_end: fromUnixSeconds(item?.current_period_end),
            cancel_at_period_end: cancellationRequested,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', stripeSubscription.id)
      }
    }
  } catch (err) {
    console.warn('Settings subscription live reconcile failed:', err)
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">Loading settings…</div>
      }
    >
      <SettingsClient
        vendor={vendor}
        email={user.email ?? ''}
        subscription={subscriptionState}
      />
    </Suspense>
  )
}
