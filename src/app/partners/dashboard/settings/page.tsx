import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SettingsClient } from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/partners/login')

  const admin = createAdminClient()
  if (!admin) return <div className="p-8 text-red-500">Server configuration error</div>

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id, business_name, bio, website_url, phone, location_address, refund_window_hours, status, subscription_current_period_end')
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
    .select('cancel_at_period_end, status, current_period_end')
    .eq('vendor_id', vendor.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <SettingsClient
      vendor={vendor}
      email={user.email ?? ''}
      subscription={{
        cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
        status: (subscription?.status as string | null) ?? null,
        currentPeriodEnd:
          (subscription?.current_period_end as string | null) ??
          vendor.subscription_current_period_end ??
          null,
      }}
    />
  )
}
