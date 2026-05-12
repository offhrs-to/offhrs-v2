import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { verifyOAuthState } from '@/lib/oauth-state'
import { googleExchangeCode, googleFetchEmail } from '@/lib/google-calendar-api'
import { upsertVendorCalendarConnection, resyncAllPublishedSessionsForVendor } from '@/lib/vendor-calendar-sync'

function appBase(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ).replace(/\/$/, '')
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appBase()}/partners/dashboard/calendar?cal_error=google_not_configured`)
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const err = url.searchParams.get('error')

  if (err) {
    return NextResponse.redirect(`${appBase()}/partners/dashboard/calendar?cal_error=${encodeURIComponent(err)}`)
  }
  if (!code || !state) {
    return NextResponse.redirect(`${appBase()}/partners/dashboard/calendar?cal_error=missing_code`)
  }

  const payload = verifyOAuthState(state)
  if (!payload || payload.provider !== 'google') {
    return NextResponse.redirect(`${appBase()}/partners/dashboard/calendar?cal_error=invalid_state`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${appBase()}/partners/login`)
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.redirect(`${appBase()}/partners/dashboard/calendar?cal_error=server`)
  }

  const { data: vendor } = await admin.from('vendor_profiles').select('id').eq('user_id', user.id).single()
  if (!vendor || vendor.id !== payload.vendorId) {
    return NextResponse.redirect(`${appBase()}/partners/dashboard/calendar?cal_error=vendor_mismatch`)
  }

  const redirectUri = `${appBase()}/api/partners/calendar/oauth/google/callback`

  try {
    const tokens = await googleExchangeCode({ clientId, clientSecret, code, redirectUri })
    const refresh = tokens.refresh_token
    if (!refresh) {
      return NextResponse.redirect(
        `${appBase()}/partners/dashboard/calendar?cal_error=` +
          encodeURIComponent('No refresh token — revoke offhrs in Google Account permissions and try again.')
      )
    }
    const email = await googleFetchEmail(tokens.access_token)
    await upsertVendorCalendarConnection(admin, {
      vendorId: vendor.id,
      provider: 'google',
      refreshToken: refresh,
      accountEmail: email,
    })
    await resyncAllPublishedSessionsForVendor(admin, vendor.id).catch((e) => console.error('[calendar] resync', e))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'oauth_failed'
    return NextResponse.redirect(`${appBase()}/partners/dashboard/calendar?cal_error=${encodeURIComponent(msg)}`)
  }

  return NextResponse.redirect(`${appBase()}/partners/dashboard/calendar?cal_connected=google`)
}
