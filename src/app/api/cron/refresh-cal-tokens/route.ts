import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const CAL_API_KEY = process.env.CAL_API_KEY
const CAL_OAUTH_CLIENT_ID = process.env.CAL_OAUTH_CLIENT_ID

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!CAL_API_KEY || !CAL_OAUTH_CLIENT_ID) {
      return NextResponse.json({ error: 'Cal.com credentials not configured' }, { status: 500 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Find tokens expiring within the next 24 hours
    const expiryThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { data: tokens, error: fetchError } = await admin
      .from('vendor_cal_tokens')
      .select('id, vendor_id, refresh_token, expires_at')
      .lt('expires_at', expiryThreshold)

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    let refreshed = 0
    let errors = 0

    for (const token of tokens ?? []) {
      try {
        const res = await fetch(
          `https://api.cal.com/v2/oauth/${CAL_OAUTH_CLIENT_ID}/refresh`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${CAL_API_KEY}`,
            },
            body: JSON.stringify({ refreshToken: token.refresh_token }),
          }
        )

        if (!res.ok) {
          throw new Error(`Cal.com refresh failed: ${res.status} ${res.statusText}`)
        }

        const data = await res.json()

        await admin.from('vendor_cal_tokens').update({
          access_token: data.accessToken,
          refresh_token: data.refreshToken ?? token.refresh_token,
          expires_at: data.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }).eq('id', token.id)

        refreshed++
      } catch (err) {
        console.error(`Failed to refresh Cal token for vendor ${token.vendor_id}:`, err)
        errors++
      }
    }

    return NextResponse.json({ refreshed, errors, total: tokens?.length ?? 0 })
  } catch (err) {
    console.error('Cal token refresh cron error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
