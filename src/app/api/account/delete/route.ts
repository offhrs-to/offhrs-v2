import { reconcileEventsByIds } from '@/lib/event-slot-reconcile'
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

    // Capture this consumer's booking event_ids BEFORE deletion so we can restore
    // available_slots on those events after the rows are gone.
    const { data: priorBookings } = await admin
      .from('bookings')
      .select('event_id')
      .eq('user_id', userId)
    const affectedEventIds = Array.from(
      new Set(
        (priorBookings ?? [])
          .map((b: { event_id: string | number | null }) => b.event_id)
          .filter((id): id is string | number => id != null)
      )
    )

    // PostgREST "table not found in schema cache" — tolerate so legacy tables that
    // have since been dropped can't block account deletion.
    const isMissingTableError = (err: { code?: string | null; message?: string | null } | null): boolean => {
      if (!err) return false
      if (err.code === 'PGRST205') return true
      const msg = (err.message ?? '').toLowerCase()
      return msg.includes('could not find the table') || msg.includes('does not exist')
    }

    type DeleteStep = {
      table: string
      run: () => Promise<{ error: { code?: string | null; message: string } | null }>
    }

    // Consumer-owned rows: explicit cleanup per table so a single FK error names the table.
    const consumerSteps: DeleteStep[] = [
      { table: 'bookings', run: async () => admin.from('bookings').delete().eq('user_id', userId) },
      { table: 'user_event_saves', run: async () => admin.from('user_event_saves').delete().eq('user_id', userId) },
      { table: 'user_vendor_saves', run: async () => admin.from('user_vendor_saves').delete().eq('user_id', userId) },
      { table: 'vendor_reviews', run: async () => admin.from('vendor_reviews').delete().eq('user_id', userId) },
      { table: 'profile_category_experience', run: async () => admin.from('profile_category_experience').delete().eq('user_id', userId) },
    ]
    for (const step of consumerSteps) {
      const { error } = await step.run()
      if (error) {
        if (isMissingTableError(error)) {
          console.warn('Account delete: skipping missing table', step.table, error.message)
          continue
        }
        console.error('Account delete: consumer data failed', step.table, error.message, userId)
        return NextResponse.json(
          { error: `Failed to delete ${step.table}: ${error.message}`, stage: step.table },
          { status: 500 }
        )
      }
    }

    // A Supabase auth user can own both account roles:
    // - consumer account: profiles + bookings/saves/reviews
    // - vendor account: vendor_profiles + partner dashboard data
    //
    // Mobile "Delete my account" only deletes the consumer role. If the same
    // login also has a vendor profile, keep auth.users intact so the partner
    // dashboard account is preserved.
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
    const hasVendorAccount = hostIds.length > 0

    // Delete only the consumer profile row. Vendor profile rows are separate and
    // must survive when the same login is also a partner account.
    const { error: profileErr } = await admin.from('profiles').delete().eq('id', userId)
    if (profileErr) {
      console.error('Account delete: profiles', profileErr.message, userId)
      return NextResponse.json(
        { error: `Failed to delete profile: ${profileErr.message}`, stage: 'profiles' },
        { status: 500 }
      )
    }

    if (hasVendorAccount) {
      try {
        await reconcileEventsByIds(admin, affectedEventIds)
      } catch (reconcileErr) {
        console.error('Account delete: slot reconcile failed', reconcileErr)
      }

      return NextResponse.json({ success: true, preservedVendorAccount: true })
    }

    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      console.error('Account delete: deleteUser', error.message, userId)
      return NextResponse.json(
        { error: `Failed to delete auth user: ${error.message}`, stage: 'auth_user' },
        { status: 500 }
      )
    }

    // Slot reconciliation: bookings the user owned (now hard-deleted) may have left
    // events.available_slots out of sync. Recompute from active booking counts so the
    // partner dashboard shows the correct number of spots remaining.
    try {
      await reconcileEventsByIds(admin, affectedEventIds)
    } catch (reconcileErr) {
      console.error('Account delete: slot reconcile failed', reconcileErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Account delete error:', message, err)
    return NextResponse.json({ error: `Internal error: ${message}`, stage: 'exception' }, { status: 500 })
  }
}
