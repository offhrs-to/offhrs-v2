import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  await admin
    .from('vendor_profiles')
    .update({ cal_connected: true })
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
