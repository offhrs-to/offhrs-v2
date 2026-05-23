import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { signOAuthState } from '@/lib/oauth-state'
import { microsoftAuthorizeUrl } from '@/lib/microsoft-calendar-api'
import { calendarOAuthAppBase } from '@/lib/calendar-oauth-app-base'

export async function GET(request: NextRequest) {
  const clientId = process.env.MICROSOFT_CALENDAR_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'Microsoft Calendar OAuth is not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  const { data: vendor } = await admin.from('vendor_profiles').select('id').eq('user_id', user.id).single()
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  const redirectUri = `${calendarOAuthAppBase(request)}/api/partners/calendar/oauth/microsoft/callback`
  const state = signOAuthState({
    vendorId: vendor.id,
    provider: 'microsoft',
    exp: Date.now() + 15 * 60 * 1000,
  })

  const url = microsoftAuthorizeUrl({ clientId, redirectUri, state })
  return NextResponse.redirect(url)
}
