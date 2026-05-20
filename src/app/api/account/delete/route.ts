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
        { error: 'Account deletion is not available', stage: 'admin_client' },
        { status: 503 }
      )
    }

    const userId = user.id

    // Consumer-owned rows: explicit cleanup per table so a single FK error names the table.
    const consumerSteps: Array<{ table: string; run: () => Promise<{ error: { message: string } | null }> }> = [
      { table: 'bookings', run: () => admin.from('bookings').delete().eq('user_id', userId) },
      { table: 'user_event_saves', run: () => admin.from('user_event_saves').delete().eq('user_id', userId) },
      { table: 'user_vendor_saves', run: () => admin.from('user_vendor_saves').delete().eq('user_id', userId) },
      { table: 'vendor_reviews', run: () => admin.from('vendor_reviews').delete().eq('user_id', userId) },
      { table: 'profile_category_experience', run: () => admin.from('profile_category_experience').delete().eq('user_id', userId) },
    ]
    for (const step of consumerSteps) {
      const { error } = await step.run()
      if (error) {
        console.error('Account delete: consumer data failed', step.table, error.message, userId)
        return NextResponse.json(
          { error: `Failed to delete ${step.table}: ${error.message}`, stage: step.table },
          { status: 500 }
        )
      }
    }

    // Same login may also own a host profile (e.g. test account); clear blocking FKs before auth delete.
    const { data: hostProfiles, error: hostLookupErr } = await admin
      .from('vendor_profiles')
      .select('id')
      .eq('user_id', userId)
    if (hostLookupErr) {
      console.error('Account delete: host lookup', hostLookupErr.message, userId)
      return NextResponse.json(
        { error: `Failed to look up host profile: ${hostLookupErr.message}`, stage: 'vendor_profiles_lookup' },
        { status: 500 }
      )
    }

    const hostIds = (hostProfiles ?? []).map((r: { id: string }) => r.id).filter(Boolean)
    if (hostIds.length > 0) {
      const hostSteps: Array<{ table: string; run: () => Promise<{ error: { message: string } | null }> }> = [
        { table: 'bookings (host)', run: () => admin.from('bookings').delete().in('vendor_id', hostIds) },
        { table: 'vendor_reviews (host)', run: () => admin.from('vendor_reviews').delete().in('vendor_profile_id', hostIds) },
        { table: 'vendor_calendar_connections', run: () => admin.from('vendor_calendar_connections').delete().in('vendor_id', hostIds) },
        { table: 'vendor_cal_tokens', run: () => admin.from('vendor_cal_tokens').delete().in('vendor_id', hostIds) },
        { table: 'vendor_payouts', run: () => admin.from('vendor_payouts').delete().in('vendor_id', hostIds) },
        { table: 'vendor_subscriptions', run: () => admin.from('vendor_subscriptions').delete().in('vendor_id', hostIds) },
        { table: 'events', run: () => admin.from('events').delete().in('vendor_profile_id', hostIds) },
        { table: 'vendor_profiles', run: () => admin.from('vendor_profiles').delete().in('id', hostIds) },
      ]
      for (const step of hostSteps) {
        const { error } = await step.run()
        if (error) {
          console.error('Account delete: host data failed', step.table, error.message, userId)
          return NextResponse.json(
            { error: `Failed to delete ${step.table}: ${error.message}`, stage: step.table },
            { status: 500 }
          )
        }
      }
    }

    // Profiles row uses id = auth.users.id (CASCADE on delete), but delete explicitly so a stale FK can't block deleteUser.
    const { error: profileErr } = await admin.from('profiles').delete().eq('id', userId)
    if (profileErr) {
      console.error('Account delete: profiles', profileErr.message, userId)
      return NextResponse.json(
        { error: `Failed to delete profile: ${profileErr.message}`, stage: 'profiles' },
        { status: 500 }
      )
    }

    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      console.error('Account delete: deleteUser', error.message, userId)
      return NextResponse.json(
        { error: `Failed to delete auth user: ${error.message}`, stage: 'auth_user' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Account delete error:', message, err)
    return NextResponse.json({ error: `Internal error: ${message}`, stage: 'exception' }, { status: 500 })
  }
}
