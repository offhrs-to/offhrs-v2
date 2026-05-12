import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { CalendarClient } from './CalendarClient'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/partners/login')

  const admin = createAdminClient()
  if (!admin) return <div className="p-8 text-red-500">Server configuration error</div>

  const { data: vendor } = await admin.from('vendor_profiles').select('id').eq('user_id', user.id).single()

  if (!vendor) redirect('/partners/signup')

  return (
    <Suspense fallback={<div className="p-6 max-w-5xl mx-auto text-sm text-[#888]">Loading calendar…</div>}>
      <CalendarClient />
    </Suspense>
  )
}
