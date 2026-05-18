import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { logSecurityEvent } from '@/lib/security-monitor'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * POST /api/account/delete
 * Deletes the authenticated consumer's account and user-owned data.
 */
export async function POST(request: NextRequest) {
  try {
    const baseKey = getRateLimitKey(request)
    const globalRl = consumeRateLimit(`account-delete:${baseKey}`, 5)
    if (!globalRl.allowed) {
      logSecurityEvent('warn', {
        type: 'rate_limited',
        route: '/api/account/delete',
        ipKey: baseKey,
      })
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(globalRl.retryAfterSeconds) } }
      )
    }

    const bearerToken = request.headers.get('authorization')?.startsWith('Bearer ')
      ? request.headers.get('authorization')!.slice(7).trim()
      : null

    const supabase = await createClient()
    let user = (await supabase.auth.getUser()).data.user

    if (!user && bearerToken) {
      const bearerClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
      )
      user = (await bearerClient.auth.getUser()).data.user ?? null
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRl = consumeRateLimit(`account-delete-user:${user.id}`, 3)
    if (!userRl.allowed) {
      logSecurityEvent('warn', {
        type: 'rate_limited',
        route: '/api/account/delete',
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(userRl.retryAfterSeconds) } }
      )
    }

    const admin = createAdminClient()
    if (!admin) {
      console.error('Account delete: admin client unavailable')
      return NextResponse.json(
        { error: 'Account deletion is not available' },
        { status: 503 }
      )
    }

    const userId = user.id

    // Consumer-owned rows (explicit so SaaS bookings with nullable user_id still clear when matched).
    const consumerDeletes = await Promise.all([
      admin.from('bookings').delete().eq('user_id', userId),
      admin.from('user_event_saves').delete().eq('user_id', userId),
      admin.from('user_vendor_saves').delete().eq('user_id', userId),
      admin.from('vendor_reviews').delete().eq('user_id', userId),
      admin.from('profile_category_experience').delete().eq('user_id', userId),
    ])
    const consumerErr = consumerDeletes.find((r) => r.error)?.error
    if (consumerErr) {
      console.error('Account delete: consumer data', consumerErr.message)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    // Same login may also own a host profile (e.g. test account); clear blocking FKs before auth delete.
    const { data: hostProfiles } = await admin
      .from('vendor_profiles')
      .select('id')
      .eq('user_id', userId)
    const hostIds = (hostProfiles ?? []).map((r: { id: string }) => r.id).filter(Boolean)
    if (hostIds.length > 0) {
      const { error: hostBookingsErr } = await admin.from('bookings').delete().in('vendor_id', hostIds)
      if (hostBookingsErr) {
        console.error('Account delete: host bookings', hostBookingsErr.message)
        return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
      }
      const { error: hostEventsErr } = await admin.from('events').delete().in('vendor_profile_id', hostIds)
      if (hostEventsErr) {
        console.error('Account delete: host events', hostEventsErr.message)
        return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
      }
    }

    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      console.error('Account delete: deleteUser', error.message, userId)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Account delete error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
