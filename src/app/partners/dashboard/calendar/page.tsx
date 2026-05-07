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

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id, cal_user_id, cal_connected')
    .eq('user_id', user.id)
    .single()

  if (!vendor) redirect('/partners/signup')

  // Fetch access token server-side to pass to client
  let accessToken: string | null = null
  if (vendor.cal_user_id) {
    const { data: tokenRow } = await admin
      .from('vendor_cal_tokens')
      .select('access_token')
      .eq('vendor_id', vendor.id)
      .single()

    if (tokenRow) {
      const { decrypt } = await import('@/lib/token-encryption')
      try {
        accessToken = decrypt(tokenRow.access_token)
      } catch {
        accessToken = null
      }
    }
  }

  return (
    <CalendarClient
      calUserId={vendor.cal_user_id}
      accessToken={accessToken}
      calConnected={vendor.cal_connected}
      vendorId={vendor.id}
    />
  )
}
