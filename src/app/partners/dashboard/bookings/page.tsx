import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { BookingsClient } from './BookingsClient'

export default async function BookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/partners/login')

  const admin = createAdminClient()
  if (!admin) return <div className="p-8 text-red-500">Server configuration error</div>

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!vendor) redirect('/partners/signup')

  const { data: sessions } = await admin
    .from('events')
    .select('id, title')
    .eq('vendor_profile_id', vendor.id)
    .neq('booking_status', 'archived')
    .order('title')

  return <BookingsClient sessions={sessions ?? []} />
}
