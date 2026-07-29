import type { SupabaseClient } from '@supabase/supabase-js'
import { processBookingRefund } from '@/lib/booking-refund'
import { syncVendorSessionToExternalCalendars } from '@/lib/vendor-calendar-sync'

const ACTIVE_BOOKING_STATUSES = ['confirmed', 'pending', 'booked', 'pending_confirmation'] as const

export type ArchivePartnerSessionResult =
  | { ok: true; refunded: number }
  | { ok: false; error: string; status: number; refunded?: number }

/** Archive a workshop, refunding active Offhrs bookings first (same as DELETE /api/partners/sessions/[id]). */
export async function archivePartnerSession(
  admin: SupabaseClient,
  vendorProfileId: string,
  sessionId: string
): Promise<ArchivePartnerSessionResult> {
  const eventId = Number(sessionId)
  if (!Number.isFinite(eventId)) {
    return { ok: false, error: 'Invalid session id', status: 400 }
  }

  const { data: session, error: sessionError } = await admin
    .from('events')
    .select('id, booking_status')
    .eq('id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle()

  if (sessionError) {
    return { ok: false, error: sessionError.message, status: 500 }
  }
  if (!session) {
    return { ok: false, error: 'Session not found', status: 404 }
  }
  if (session.booking_status === 'archived') {
    return { ok: true, refunded: 0 }
  }

  const { data: activeBookings, error: bookingFetchError } = await admin
    .from('bookings')
    .select('id')
    .eq('event_id', eventId)
    .eq('vendor_id', vendorProfileId)
    .in('status', [...ACTIVE_BOOKING_STATUSES])
    .is('refunded_at', null)

  if (bookingFetchError) {
    console.error('Session archive booking fetch error:', bookingFetchError)
    return { ok: false, error: bookingFetchError.message, status: 500 }
  }

  let refundedCount = 0
  for (const booking of activeBookings ?? []) {
    const bookingId = String(booking.id)
    const refund = await processBookingRefund(admin, bookingId, {
      initiatedBy: 'vendor',
      cancellationReason: 'Workshop archived by vendor',
      skipRefundWindowCheck: true,
    })

    if (!refund.ok) {
      return {
        ok: false,
        error:
          refundedCount > 0
            ? `Archiving was stopped after ${refundedCount} refund${refundedCount === 1 ? '' : 's'} because one booking could not be refunded: ${refund.error}`
            : `Could not archive workshop because a booking could not be refunded: ${refund.error}`,
        status: refund.status,
        refunded: refundedCount,
      }
    }
    refundedCount++
  }

  const { data: updated, error: updateError } = await admin
    .from('events')
    .update({ booking_status: 'archived' })
    .eq('id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .select('id, booking_status')
    .maybeSingle()

  if (updateError) {
    console.error('Session archive error:', updateError)
    return { ok: false, error: updateError.message, status: 500 }
  }
  if (!updated || updated.booking_status !== 'archived') {
    return { ok: false, error: 'Could not archive workshop', status: 500 }
  }

  void syncVendorSessionToExternalCalendars(admin, vendorProfileId, String(eventId)).catch((e) =>
    console.error('[sessions] calendar sync', e)
  )

  return { ok: true, refunded: refundedCount }
}
