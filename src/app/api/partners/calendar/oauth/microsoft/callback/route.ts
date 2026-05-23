import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { verifyOAuthState } from '@/lib/oauth-state'
import {
  microsoftEmailFromIdToken,
  microsoftExchangeCode,
  microsoftFetchEmail,
} from '@/lib/microsoft-calendar-api'
import { upsertVendorCalendarConnection, resyncAllPublishedSessionsForVendor } from '@/lib/vendor-calendar-sync'
import { calendarOAuthAppBase } from '@/lib/calendar-oauth-app-base'

export async function GET(request: NextRequest) {
  const clientId = process.env.MICROSOFT_CALENDAR_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${calendarOAuthAppBase(request)}/partners/dashboard/calendar?calendar_error=microsoft_not_configured`)
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const err = url.searchParams.get('error')

  if (err) {
    return NextResponse.redirect(`${calendarOAuthAppBase(request)}/partners/dashboard/calendar?calendar_error=${encodeURIComponent(err)}`)
  }
  if (!code || !state) {
    return NextResponse.redirect(`${calendarOAuthAppBase(request)}/partners/dashboard/calendar?calendar_error=missing_code`)
  }

  const payload = verifyOAuthState(state)
  if (!payload || payload.provider !== 'microsoft') {
    return NextResponse.redirect(`${calendarOAuthAppBase(request)}/partners/dashboard/calendar?calendar_error=invalid_state`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${calendarOAuthAppBase(request)}/partners/login`)
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.redirect(`${calendarOAuthAppBase(request)}/partners/dashboard/calendar?calendar_error=server`)
  }

  const { data: vendor } = await admin.from('vendor_profiles').select('id').eq('user_id', user.id).single()
  if (!vendor || vendor.id !== payload.vendorId) {
    return NextResponse.redirect(`${calendarOAuthAppBase(request)}/partners/dashboard/calendar?calendar_error=vendor_mismatch`)
  }

  const redirectUri = `${calendarOAuthAppBase(request)}/api/partners/calendar/oauth/microsoft/callback`

  try {
    const tokens = await microsoftExchangeCode({ clientId, clientSecret, code, redirectUri })
    const refresh = tokens.refresh_token
    if (!refresh) {
      return NextResponse.redirect(
        `${calendarOAuthAppBase(request)}/partners/dashboard/calendar?calendar_error=` +
          encodeURIComponent('No refresh token — try again and accept all permissions.')
      )
    }
    const emailFromGraph = await microsoftFetchEmail(tokens.access_token)
    const email = emailFromGraph ?? microsoftEmailFromIdToken(tokens.id_token)
    await upsertVendorCalendarConnection(admin, {
      vendorId: vendor.id,
      provider: 'microsoft',
      refreshToken: refresh,
      accountEmail: email,
    })
    await resyncAllPublishedSessionsForVendor(admin, vendor.id).catch((e) => console.error('[calendar] resync', e))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'oauth_failed'
    return NextResponse.redirect(`${calendarOAuthAppBase(request)}/partners/dashboard/calendar?calendar_error=${encodeURIComponent(msg)}`)
  }

  return NextResponse.redirect(`${calendarOAuthAppBase(request)}/partners/dashboard/calendar?calendar_connected=microsoft`)
}
