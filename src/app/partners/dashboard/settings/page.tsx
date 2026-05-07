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

  return <SettingsClient vendor={vendor} email={user.email ?? ''} />
}
