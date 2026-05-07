import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { decrypt } from '@/lib/token-encryption'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    const { data: tokens } = await admin
      .from('vendor_cal_tokens')
      .select('access_token, expires_at')
      .eq('vendor_id', vendor.id)
      .single()

    if (!tokens) {
      return NextResponse.json({ error: 'Cal.com not connected' }, { status: 404 })
    }

    return NextResponse.json({
      accessToken: decrypt(tokens.access_token),
      expiresAt: tokens.expires_at,
    })
  } catch (err) {
    console.error('Cal token fetch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
