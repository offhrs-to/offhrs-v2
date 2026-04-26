import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMobileAttestation } from '@/lib/mobile-attestation'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { logSecurityEvent } from '@/lib/security-monitor'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/account/delete
 * Deletes the authenticated user's account and user-owned data.
 * Cascades remove rows in user-owned tables (profiles, bookings, saves, reviews, category experience).
 * Analytics rows may remain anonymized (e.g. event_redirects.user_id is set to null).
 */
export async function POST(request: NextRequest) {
  try {
    const attestation = await requireMobileAttestation(request, '/api/account/delete')
    if (!attestation.ok) {
      logSecurityEvent('warn', {
        type: 'attestation_failed',
        route: '/api/account/delete',
        details: { status: attestation.status },
      })
      return NextResponse.json({ error: attestation.error }, { status: attestation.status })
    }

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

    const supabase = await createClient()
    let user = (await supabase.auth.getUser()).data.user

    const authHeader = request.headers.get('authorization')
    if (!user && authHeader?.startsWith('Bearer ')) {
      const { createClient: createSupabase } = await import('@supabase/supabase-js')
      const client = createSupabase(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: authHeader } } }
      )
      user = (await client.auth.getUser()).data.user
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
      return NextResponse.json(
        { error: 'Account deletion is not available' },
        { status: 503 }
      )
    }

    const userId = user.id
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      console.error('Account delete error:', error)
      return NextResponse.json(
        { error: error.message ?? 'Failed to delete account' },
        { status: 500 }
      )
    }

    // Verify user-owned tables are empty after auth deletion/cascades.
    // Keep analytics anonymization behavior (do not delete event_redirects rows).
    const checks = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('id', userId),
      admin.from('bookings').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      admin.from('user_event_saves').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      admin.from('user_vendor_saves').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      admin.from('vendor_reviews').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      admin
        .from('profile_category_experience')
        .select('user_id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ])
    const remaining = checks.map((r) => r.count ?? 0).reduce((sum, n) => sum + n, 0)
    if (remaining > 0) {
      console.warn('Account delete verification found remaining rows', {
        userId,
        profiles: checks[0].count ?? 0,
        bookings: checks[1].count ?? 0,
        user_event_saves: checks[2].count ?? 0,
        user_vendor_saves: checks[3].count ?? 0,
        vendor_reviews: checks[4].count ?? 0,
        profile_category_experience: checks[5].count ?? 0,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Account delete error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
