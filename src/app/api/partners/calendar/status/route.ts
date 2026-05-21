import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { decrypt } from '@/lib/token-encryption'
import {
  microsoftFetchEmail,
  microsoftRefreshAccessToken,
} from '@/lib/microsoft-calendar-api'

/**
 * Self-heal missing account_email for legacy Microsoft connection rows that were
 * written before User.Read was in scope. Uses the stored refresh token to mint
 * a fresh access token, calls Graph /me, and persists the result.
 */
async function backfillMicrosoftAccountEmail(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  vendorId: string,
  encryptedRefreshToken: string
): Promise<string | null> {
  const clientId = process.env.MICROSOFT_CALENDAR_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  let refreshToken: string
  try {
    refreshToken = decrypt(encryptedRefreshToken)
  } catch (err) {
    console.warn('backfillMicrosoftAccountEmail: decrypt failed', err)
    return null
  }
  try {
    const { access_token } = await microsoftRefreshAccessToken({ clientId, clientSecret, refreshToken })
    const email = await microsoftFetchEmail(access_token)
    if (!email) return null
    await admin
      .from('vendor_calendar_connections')
      .update({ account_email: email, updated_at: new Date().toISOString() })
      .eq('vendor_id', vendorId)
      .eq('provider', 'microsoft')
    return email
  } catch (err) {
    console.warn('backfillMicrosoftAccountEmail: refresh/fetch failed', err)
    return null
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  const { data: vendor } = await admin.from('vendor_profiles').select('id').eq('user_id', user.id).single()
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  const { data: rows } = await admin
    .from('vendor_calendar_connections')
    .select('provider, account_email, refresh_token_encrypted')
    .eq('vendor_id', vendor.id)

  const googleRow = rows?.find((r) => r.provider === 'google')
  const msRow = rows?.find((r) => r.provider === 'microsoft')

  let msEmail = msRow?.account_email ?? null
  if (msRow && !msEmail && msRow.refresh_token_encrypted) {
    msEmail = await backfillMicrosoftAccountEmail(
      admin,
      vendor.id,
      msRow.refresh_token_encrypted as string
    )
  }

  return NextResponse.json({
    configured: {
      google: Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET),
      microsoft: Boolean(process.env.MICROSOFT_CALENDAR_CLIENT_ID && process.env.MICROSOFT_CALENDAR_CLIENT_SECRET),
    },
    google: { connected: Boolean(googleRow), email: googleRow?.account_email ?? null },
    microsoft: { connected: Boolean(msRow), email: msEmail },
  })
}
