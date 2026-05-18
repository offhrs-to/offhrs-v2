import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import {
  sendConsumerBookingCancelled,
  sendConsumerRefundConfirmation,
  type BookingEmailParams,
} from '@/lib/emails'
import { computeSlotIncrementForEvent } from '@/lib/workshop-series'
import { syncVendorSessionToExternalCalendars } from '@/lib/vendor-calendar-sync'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

const PLATFORM_MIN_REFUND_HOURS = 24

export type RefundInitiator = 'consumer' | 'vendor' | 'stripe_webhook'

export function getEffectiveRefundWindowHours(vendorRefundWindowHours: number | null | undefined): number {
  return Math.max(vendorRefundWindowHours ?? 48, PLATFORM_MIN_REFUND_HOURS)
}

export function checkRefundWindowEligibility(
  sessionStartsAt: string | null | undefined,
  eventDate: string | null | undefined,
  refundWindowHours: number | null | undefined
): {
  eligible: boolean
  minWindowHours: number
  hoursUntilSession: number | null
  sessionStartIso: string | null
} {
  const minWindowHours = getEffectiveRefundWindowHours(refundWindowHours)
  const sessionStartIso = sessionStartsAt?.trim() || eventDate?.trim() || null
  if (!sessionStartIso) {
    return { eligible: true, minWindowHours, hoursUntilSession: null, sessionStartIso: null }
  }
  const sessionStart = new Date(sessionStartIso)
  if (Number.isNaN(sessionStart.getTime())) {
    return { eligible: true, minWindowHours, hoursUntilSession: null, sessionStartIso }
  }
  const hoursUntilSession = (sessionStart.getTime() - Date.now()) / (1000 * 60 * 60)
  return {
    eligible: hoursUntilSession >= minWindowHours,
    minWindowHours,
    hoursUntilSession,
    sessionStartIso,
  }
}

type EventJoin = {
  title?: string
  date?: string | null
  location?: string | null
  duration_minutes?: number | null
  workshop_series?: string | null
  series_occurrences?: unknown
  available_slots?: number | null
  booking_status?: string | null
  max_attendees?: number | null
}

type BookingRow = {
  id: string
  user_id: string | null
  vendor_id: string | null
  event_id: number | string | null
  name: string | null
  email: string | null
  stripe_payment_intent_id: string | null
  amount_cad: number | null
  total_cad: number | null
  status: string | null
  refunded_at: string | null
  session_starts_at: string | null
  events: EventJoin | EventJoin[] | null
}

function resolveEvent(booking: BookingRow): EventJoin | null {
  const ev = booking.events
  if (!ev) return null
  return Array.isArray(ev) ? ev[0] ?? null : ev
}

async function sendRefundEmails(
  booking: BookingRow,
  event: EventJoin,
  vendorBusinessName: string,
  vendorWebsite: string | null,
  amountCad: number
): Promise<void> {
  const attendeeEmail = booking.email?.trim()
  const attendeeName = booking.name?.trim() || 'Guest'
  if (!attendeeEmail) return

  const sessionDateIso = booking.session_starts_at ?? event.date ?? null
  const sessionDate = sessionDateIso ? new Date(sessionDateIso) : new Date()
  const durationMinutes = (event.duration_minutes ?? 60) as number

  const emailParams: BookingEmailParams = {
    attendeeName,
    attendeeEmail,
    sessionTitle: event.title ?? 'Workshop',
    vendorName: vendorBusinessName,
    sessionDate,
    durationMinutes,
    location: event.location ?? null,
    vendorWebsite,
    bookingRef: booking.id,
    amountCad,
  }

  await Promise.all([
    sendConsumerBookingCancelled(emailParams),
    amountCad > 0
      ? sendConsumerRefundConfirmation(
          attendeeEmail,
          attendeeName,
          event.title ?? 'Workshop',
          amountCad,
          booking.id
        )
      : Promise.resolve(),
  ])
}

export async function processBookingRefund(
  admin: SupabaseClient,
  bookingId: string,
  options: {
    initiatedBy: RefundInitiator
    cancellationReason: string
    /** Set when Stripe already processed the refund (Dashboard / webhook). */
    stripeAlreadyRefunded?: boolean
    /** Required for consumer-initiated refunds. */
    consumerUserId?: string
    skipRefundWindowCheck?: boolean
  }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: booking, error: fetchError } = await admin
    .from('bookings')
    .select(
      `
      id, user_id, vendor_id, event_id, name, email,
      stripe_payment_intent_id, amount_cad, total_cad,
      status, refunded_at, session_starts_at,
      events ( title, date, location, duration_minutes, workshop_series, series_occurrences, available_slots, booking_status, max_attendees )
    `
    )
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    return { ok: false, error: 'Booking not found', status: 404 }
  }

  const row = booking as BookingRow
  if (row.status === 'refunded' || row.refunded_at) {
    return { ok: false, error: 'Already refunded', status: 409 }
  }
  if (row.status === 'cancelled') {
    return { ok: false, error: 'Booking is already cancelled', status: 409 }
  }

  if (options.initiatedBy === 'consumer') {
    if (!options.consumerUserId || row.user_id !== options.consumerUserId) {
      return { ok: false, error: 'Forbidden', status: 403 }
    }
  }

  const ev = resolveEvent(row)
  if (!ev) {
    return { ok: false, error: 'Workshop not found for this booking', status: 404 }
  }

  let refundWindowHours = 48
  let vendorBusinessName = 'offhrs'
  let vendorWebsite: string | null = null

  if (row.vendor_id) {
    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id, business_name, website_url, refund_window_hours')
      .eq('id', row.vendor_id)
      .single()
    if (vendor) {
      refundWindowHours = (vendor.refund_window_hours as number | null) ?? 48
      vendorBusinessName = vendor.business_name ?? vendorBusinessName
      vendorWebsite = (vendor.website_url as string | null) ?? null
    }
  }

  if (!options.skipRefundWindowCheck && options.initiatedBy !== 'stripe_webhook') {
    const window = checkRefundWindowEligibility(
      row.session_starts_at,
      ev.date,
      refundWindowHours
    )
    if (!window.eligible) {
      return {
        ok: false,
        error: `Cancellations with a full refund must be made at least ${window.minWindowHours} hours before the session starts.`,
        status: 403,
      }
    }
  }

  const chargeAmountCad =
    row.total_cad != null && Number(row.total_cad) > 0
      ? Number(row.total_cad)
      : Number(row.amount_cad ?? 0)

  if (!options.stripeAlreadyRefunded && row.stripe_payment_intent_id) {
    try {
      await stripe.refunds.create({
        payment_intent: row.stripe_payment_intent_id,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stripe refund failed'
      return { ok: false, error: msg, status: 502 }
    }
  }

  await admin
    .from('bookings')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      cancellation_reason: options.cancellationReason,
    })
    .eq('id', bookingId)

  const eventRow = {
    workshop_series: ev.workshop_series,
    series_occurrences: ev.series_occurrences,
    date: ev.date ?? null,
    available_slots: ev.available_slots,
    max_attendees: ev.max_attendees,
    booking_status: ev.booking_status,
  }
  const inc = computeSlotIncrementForEvent(
    eventRow,
    row.session_starts_at ?? ev.date ?? null
  )
  if (inc && row.event_id != null) {
    const eventUpdate: Record<string, unknown> = {
      available_slots: inc.available_slots,
      booking_status: inc.booking_status,
    }
    if (inc.series_occurrences) eventUpdate.series_occurrences = inc.series_occurrences
    await admin.from('events').update(eventUpdate).eq('id', row.event_id)
    if (row.vendor_id) {
      void syncVendorSessionToExternalCalendars(admin, row.vendor_id, String(row.event_id)).catch(
        () => {}
      )
    }
  } else if (row.event_id != null) {
    await admin.rpc('increment_available_slots', { booking_event_id: row.event_id }).maybeSingle()
  }

  try {
    await sendRefundEmails(row, ev, vendorBusinessName, vendorWebsite, chargeAmountCad)
  } catch (emailErr) {
    console.error('Refund confirmation email error:', emailErr)
  }

  return { ok: true }
}

/** Mark booking refunded when Stripe already issued refund (webhook / Dashboard). */
export async function syncBookingRefundedFromStripe(
  admin: SupabaseClient,
  paymentIntentId: string
): Promise<void> {
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, refunded_at')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle()

  if (!booking || booking.status === 'refunded' || booking.refunded_at) {
    return
  }

  await processBookingRefund(admin, booking.id, {
    initiatedBy: 'stripe_webhook',
    cancellationReason: 'Refund processed in Stripe',
    stripeAlreadyRefunded: true,
    skipRefundWindowCheck: true,
  })
}
