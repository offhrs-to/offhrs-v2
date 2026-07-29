import { reconcileEventsByIds } from '@/lib/event-slot-reconcile'
import { processBookingRefund } from '@/lib/booking-refund'
import { createAdminClient } from '@/lib/supabase/admin'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { logSecurityEvent } from '@/lib/security-monitor'
import { resolveApiUser, extractBearerToken } from '@/lib/resolve-api-user'
import { NextRequest, NextResponse } from 'next/server'

const ACTIVE_BOOKING_STATUSES = new Set([
  'confirmed',
  'pending',
  'booked',
  'pending_confirmation',
])

/**
 * POST /api/account/delete
 * Deletes the authenticated consumer's account and user-owned data.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await resolveApiUser(request)

    if (!user) {
      const ipKey = getRateLimitKey(request)
      const probeRl = consumeRateLimit(`account-delete-probe:${ipKey}`, 30)
      if (!probeRl.allowed) {
        logSecurityEvent('warn', {
          type: 'rate_limited',
          route: '/api/account/delete',
          ipKey,
        })
        return NextResponse.json(
          { error: 'Too many requests. Wait a minute and try again.' },
          { status: 429, headers: { 'Retry-After': String(probeRl.retryAfterSeconds) } }
        )
      }

      const hadBearer = !!extractBearerToken(request)
      return NextResponse.json(
        {
          error: hadBearer
            ? 'Could not verify your session. Sign out, sign in again, and retry.'
            : 'Unauthorized',
        },
        { status: 401 }
      )
    }

    // Authenticated deletes only — 5 attempts per 15 minutes (failed auth no longer burns this).
    const userRl = consumeRateLimit(`account-delete-user:${user.id}`, 5, 15 * 60 * 1000)
    if (!userRl.allowed) {
      logSecurityEvent('warn', {
        type: 'rate_limited',
        route: '/api/account/delete',
        userId: user.id,
      })
      return NextResponse.json(
        {
          error: `Too many delete attempts. Try again in about ${userRl.retryAfterSeconds} seconds.`,
        },
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

    // Capture this consumer's booking event_ids BEFORE deletion so we can reconcile
    // available_slots on those events as a safety net.
    const { data: priorBookings } = await admin
      .from('bookings')
      .select('id, event_id, status, refunded_at, stripe_payment_intent_id')
      .eq('user_id', userId)
    const affectedEventIds = Array.from(
      new Set(
        (priorBookings ?? [])
          .map((b: { event_id: string | number | null }) => b.event_id)
          .filter((id): id is string | number => id != null)
      )
    )

    // 1) Refund any active bookings via Stripe BEFORE the booking row is touched.
    //    Account deletion must not strand customer funds in our platform balance.
    //    `processBookingRefund` handles:
    //      - Issuing the Stripe refund (skipped if no PI / already refunded)
    //      - Marking the row status='refunded' + refunded_at
    //      - Restoring event/series slot counts on the vendor side
    //      - Sending the refund confirmation + cancellation emails
    //    We pass skipRefundWindowCheck so the platform's 24h window doesn't block
    //    a refund triggered by account deletion.
    const refundFailures: { bookingId: string; error: string }[] = []
    for (const b of priorBookings ?? []) {
      const status = (b.status as string | null)?.toLowerCase() ?? ''
      const isActive = ACTIVE_BOOKING_STATUSES.has(status) && !b.refunded_at
      if (!isActive) continue

      const result = await processBookingRefund(admin, b.id as string, {
        initiatedBy: 'consumer',
        consumerUserId: userId,
        consumerEmail: user.email ?? null,
        cancellationReason: 'Account deleted by user',
        skipRefundWindowCheck: true,
      })

      if (!result.ok) {
        console.error(
          'Account delete: refund failed for booking',
          b.id,
          result.error,
          userId
        )
        refundFailures.push({ bookingId: b.id as string, error: result.error })
      }
    }

    if (refundFailures.length > 0) {
      // Stop deletion if any refund failed — leave the booking rows intact (with
      // original PII) so support can manually refund via Stripe and try again.
      return NextResponse.json(
        {
          error:
            'We could not refund one or more of your bookings automatically. Please contact support to complete account deletion.',
          failedBookings: refundFailures,
          stage: 'booking_refund',
        },
        { status: 502 }
      )
    }

    // 2) Anonymize PII on this user's bookings instead of hard-deleting them.
    //    Keeps the row for vendor records, refund history, Stripe reconciliation,
    //    and the "Refunded" badge on the partner dashboard. Setting user_id=NULL
    //    also detaches the booking from auth.users so it survives the cascade
    //    when admin.auth.admin.deleteUser() runs below.
    if ((priorBookings ?? []).length > 0) {
      const { error: anonymizeErr } = await admin
        .from('bookings')
        .update({
          user_id: null,
          name: 'Deleted user',
          email: null,
        })
        .eq('user_id', userId)
      if (anonymizeErr) {
        console.error('Account delete: anonymize bookings failed', anonymizeErr.message, userId)
        return NextResponse.json(
          {
            error: `Failed to anonymize bookings: ${anonymizeErr.message}`,
            stage: 'bookings_anonymize',
          },
          { status: 500 }
        )
      }
    }

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
    // Note: bookings are intentionally NOT hard-deleted (they're refunded + anonymized above).
    const consumerSteps: DeleteStep[] = [
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

    // Slot reconciliation: belt-and-suspenders. processBookingRefund already
    // restores series_occurrences / available_slots; this just recomputes from
    // active-booking counts in case any prior row was stuck out of sync.
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
