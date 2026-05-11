import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { provisionCalUser } from '@/lib/cal'
import { encrypt } from '@/lib/token-encryption'

// POST /api/partners/cal/provision
// Ensures the vendor has a Cal.com managed user + encrypted tokens.
// Used as a manual fallback when Stripe subscription provisioning didn't populate cal_user_id/tokens.
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id, business_name, cal_user_id, user_id')
      .eq('user_id', user.id)
      .single()

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    // If we already have tokens, treat it as provisioned.
    const { data: tokenRow } = await admin
      .from('vendor_cal_tokens')
      .select('access_token')
      .eq('vendor_id', vendor.id)
      .single()

    if (tokenRow?.access_token && vendor.cal_user_id) {
      return NextResponse.json({ success: true })
    }

    const calUser = await provisionCalUser(user.email ?? '', vendor.business_name)

    await admin.from('vendor_profiles')
      .update({ cal_user_id: String(calUser.id) })
      .eq('id', vendor.id)

    await admin.from('vendor_cal_tokens').upsert({
      vendor_id: vendor.id,
      access_token: encrypt(calUser.accessToken),
      refresh_token: encrypt(calUser.refreshToken),
      expires_at: calUser.accessTokenExpiresAt,
    }, { onConflict: 'vendor_id' })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

