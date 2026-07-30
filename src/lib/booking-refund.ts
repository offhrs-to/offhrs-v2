import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import {
  sendConsumerBookingCancelled,
  sendConsumerRefundConfirmation,
  sendVendorBookingRefunded,
  type BookingEmailParams,
} from '@/lib/emails'
import {
  computeSlotIncrementForEvent,
  parseSeriesOccurrences,
  type EventSeriesFields,
} from '@/lib/workshop-series'
import { scheduleVendorSessionCalendarSync } from '@/lib/vendor-calendar-sync'
import { reverseWorkshopTaxTransaction } from '@/lib/stripe-workshop-tax'
import { clawBackXpForBooking } from '@/lib/workshop-xp'
import {
  isStrictNoRefundPolicy,
  STRICT_REFUND_CONSUMER_BLOCK_MESSAGE,
} from '@/lib/vendor-refund-policy'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

const PLATFORM_MIN_REFUND_HOURS = 24
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

const ACTIVE_BOOKING_STATUSES = [
  'confirmed',
  'pending',
  'booked',
  'pending_confirmation',
  'attended',
] as const

export type RefundInitiator = 'consumer' | 'vendor' | 'stripe_webhook'

function isStripeChargeAlreadyRefunded(err: unknown): boolean {
  if (err instanceof Stripe.errors.StripeError) {
    return err.code === 'charge_already_refunded'
  }
  const msg = err instanceof Error ? err.message : String(err)
  return /already been refunded/i.test(msg)
}

async function paymentIntentHasSuccessfulRefund(paymentIntentId: string): Promise<boolean> {
  try {
    const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 5 })
    return refunds.data.some((r) => r.status === 'succeeded' || r.status === 'pending')
  } catch {
    return false
  }
}

/** Reconcile top-level available_slots from active booking count (single-session workshops). */
async function reconcileEventSlotsFromBookings(
  admin: SupabaseClient,
  eventId: string | number,
  eventRow: EventSeriesFields
): Promise<void> {
  if (parseSeriesOccurrences(eventRow).length > 0) return

  const max = eventRow.max_attendees ?? 0
  if (max <= 0) return

  const { count, error: countError } = await admin
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .in('status', [...ACTIVE_BOOKING_STATUSES])

  if (countError) {
    console.error('reconcileEventSlotsFromBookings count error:', countError)
    return
  }

  const filled = count ?? 0
  const available_slots = Math.max(0, max - filled)
  const nextStatus =
    available_slots > 0 && eventRow.booking_status === 'fully_booked'
      ? 'published'
      : eventRow.booking_status

  const { error: updateError } = await admin
    .from('events')
    .update({ available_slots, booking_status: nextStatus })
    .eq('id', eventId)

  if (updateError) {
    console.error('reconcileEventSlotsFromBookings update error:', updateError)
  }
}

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
  stripe_tax_transaction_id: string | null
  amount_cad: number | null
  total_cad: number | null
  stripe_fee_cad: number | null
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
  amountCad: number,
  stripeFeeCad: number,
  vendorEmail: string | null
): Promise<void> {
  const attendeeEmail = booking.email?.trim()
  const attendeeName = booking.name?.trim() || 'Guest'
  if (!attendeeEmail && !vendorEmail) return

  const sessionDateIso = booking.session_starts_at ?? event.date ?? null
  const sessionDate = sessionDateIso ? new Date(sessionDateIso) : new Date()
  const durationMinutes = (event.duration_minutes ?? 60) as number

  const emailParams: BookingEmailParams | null = attendeeEmail
    ? {
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
    : null

  // Paid bookings: send only the refund confirmation (it already states the
  // booking was cancelled and includes the refund amount, so the separate
  // "Booking cancelled" email is redundant and its 5-10 day language conflicts
  // with the refund-confirmed message).
  // Free bookings: send the cancellation email since there is no refund.
  await Promise.all([
    emailParams && amountCad > 0
      ? sendConsumerRefundConfirmation(
          emailParams.attendeeEmail,
          attendeeName,
          event.title ?? 'Workshop',
          amountCad,
          booking.id,
          emailParams
        )
      : emailParams
        ? sendConsumerBookingCancelled(emailParams)
        : Promise.resolve(),
    vendorEmail
      ? sendVendorBookingRefunded(vendorEmail, {
          businessName: vendorBusinessName,
          attendeeName,
          attendeeEmail: attendeeEmail ?? null,
          sessionTitle: event.title ?? 'Workshop',
          amountCad,
          stripeFeeCad,
          dashboardUrl: `${APP_URL}/partners/dashboard/bookings`,
        })
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
    consumerEmail?: string | null
    skipRefundWindowCheck?: boolean
  }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: booking, error: fetchError } = await admin
    .from('bookings')
    .select(
      `
      id, user_id, vendor_id, event_id, name, email,
      stripe_payment_intent_id, stripe_tax_transaction_id, amount_cad, total_cad, stripe_fee_cad,
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
    if (!options.consumerUserId) {
      return { ok: false, error: 'Unauthorized', status: 401 }
    }
    const userIdMatch = row.user_id === options.consumerUserId
    const consumerEmail = options.consumerEmail?.trim().toLowerCase() ?? ''
    const bookingEmail = row.email?.trim().toLowerCase() ?? ''
    const emailMatch = Boolean(consumerEmail && bookingEmail && consumerEmail === bookingEmail)
    if (!userIdMatch && !emailMatch) {
      return { ok: false, error: 'You can only cancel your own bookings', status: 403 }
    }
    if (!row.user_id && emailMatch) {
      await admin.from('bookings').update({ user_id: options.consumerUserId }).eq('id', bookingId)
      row.user_id = options.consumerUserId
    }
  }

  let ev = resolveEvent(row)
  if (!ev && row.event_id != null) {
    const { data: eventRow } = await admin
      .from('events')
      .select(
        'title, date, location, duration_minutes, workshop_series, series_occurrences, available_slots, booking_status, max_attendees'
      )
      .eq('id', row.event_id)
      .maybeSingle()
    ev = (eventRow as EventJoin | null) ?? null
  }
  if (!ev) {
    return { ok: false, error: 'Workshop not found for this booking', status: 404 }
  }

  let refundWindowHours = 48
  let strictNoRefund = false
  let vendorBusinessName = 'offhrs'
  let vendorWebsite: string | null = null
  let vendorEmail: string | null = null

  if (row.vendor_id) {
    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id, business_name, website_url, refund_window_hours, strict_no_refund, user_id')
      .eq('id', row.vendor_id)
      .single()
    if (vendor) {
      refundWindowHours = (vendor.refund_window_hours as number | null) ?? 48
      strictNoRefund = isStrictNoRefundPolicy(vendor)
      vendorBusinessName = vendor.business_name ?? vendorBusinessName
      vendorWebsite = (vendor.website_url as string | null) ?? null
      const vendorUserId = vendor.user_id as string | null
      if (vendorUserId) {
        const { data: authUser } = await admin.auth.admin.getUserById(vendorUserId)
        vendorEmail = authUser?.user?.email ?? null
      }
    }
  }

  const chargeAmountCad =
    row.total_cad != null && Number(row.total_cad) > 0
      ? Number(row.total_cad)
      : Number(row.amount_cad ?? 0)

  if (!options.skipRefundWindowCheck && options.initiatedBy !== 'stripe_webhook') {
    if (strictNoRefund && chargeAmountCad > 0) {
      return {
        ok: false,
        error: STRICT_REFUND_CONSUMER_BLOCK_MESSAGE,
        status: 403,
      }
    }

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

  let stripeAlreadyRefunded = options.stripeAlreadyRefunded ?? false
  if (!stripeAlreadyRefunded && row.stripe_payment_intent_id) {
    stripeAlreadyRefunded = await paymentIntentHasSuccessfulRefund(row.stripe_payment_intent_id)
  }

  const repairingStripeOnlyRefund =
    stripeAlreadyRefunded && row.status !== 'refunded' && !row.refunded_at

  if (!stripeAlreadyRefunded && row.stripe_payment_intent_id) {
    try {
      // Destination charges: refunds on the platform pay the customer back; we
      // reverse_transfer to pull funds from the connected (vendor) account.
      //
      // When we charged an application_fee_amount (Express accounts where the
      // platform recoups Stripe processing), refund_application_fee MUST be true
      // on a full refund or the connected account lacks balance for reversal
      // (e.g. $0.80 net vs $1.13 reverse). Stripe still does not return the
      // original card processing fee to anyone — the vendor absorbs that cost.
      //
      // Accounts with controller.fees.payer=account have no application fee;
      // refund_application_fee stays false.
      // Docs: https://docs.stripe.com/connect/destination-charges#issuing-refunds
      const pi = await stripe.paymentIntents.retrieve(row.stripe_payment_intent_id)
      let applicationFeeCents = pi.application_fee_amount ?? 0
      if (!applicationFeeCents) {
        const parsed = Number.parseInt(pi.metadata?.application_fee_cents ?? '0', 10)
        applicationFeeCents = Number.isFinite(parsed) ? parsed : 0
      }
      const refundApplicationFee = applicationFeeCents > 0

      await stripe.refunds.create({
        payment_intent: row.stripe_payment_intent_id,
        reverse_transfer: true,
        refund_application_fee: refundApplicationFee,
      })

      const connectedAccountId = pi.metadata?.stripe_account_id?.trim() || null
      const taxTransactionId = row.stripe_tax_transaction_id?.trim() || null
      if (connectedAccountId && taxTransactionId) {
        try {
          await reverseWorkshopTaxTransaction(stripe, {
            connectedAccountId,
            taxTransactionId,
            paymentIntentId: row.stripe_payment_intent_id,
          })
        } catch (taxRevErr) {
          console.warn('Stripe Tax reversal after refund failed:', taxRevErr)
        }
      }
    } catch (err) {
      if (isStripeChargeAlreadyRefunded(err)) {
        stripeAlreadyRefunded = true
      } else {
        const msg = err instanceof Error ? err.message : 'Stripe refund failed'
        return { ok: false, error: msg, status: 502 }
      }
    }
  }

  const refundedAt = new Date().toISOString()
  const { error: bookingUpdateError } = await admin
    .from('bookings')
    .update({
      status: 'refunded',
      refunded_at: refundedAt,
      cancellation_reason: options.cancellationReason,
    })
    .eq('id', bookingId)

  if (bookingUpdateError) {
    console.error('Booking refund status update failed:', bookingUpdateError)
    return {
      ok: false,
      error: 'Could not update booking after refund. Please contact support.',
      status: 500,
    }
  }

  try {
    await clawBackXpForBooking(admin, bookingId)
  } catch (xpErr) {
    console.error('XP clawback after refund failed:', bookingId, xpErr)
  }

  const eventRow: EventSeriesFields = {
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
    const { error: eventUpdateError } = await admin
      .from('events')
      .update(eventUpdate)
      .eq('id', row.event_id)
    if (eventUpdateError) {
      console.error('Event slot increment after refund failed:', eventUpdateError)
      await reconcileEventSlotsFromBookings(admin, row.event_id, eventRow)
    } else if (row.vendor_id) {
      scheduleVendorSessionCalendarSync(admin, row.vendor_id, String(row.event_id))
    }
  } else if (row.event_id != null) {
    const { error: rpcError } = await admin
      .rpc('increment_available_slots', { booking_event_id: row.event_id })
      .maybeSingle()
    if (rpcError) {
      console.error('increment_available_slots RPC failed:', rpcError)
    }
    await reconcileEventSlotsFromBookings(admin, row.event_id, eventRow)
  }

  if (!repairingStripeOnlyRefund) {
    try {
      await sendRefundEmails(
        row,
        ev,
        vendorBusinessName,
        vendorWebsite,
        chargeAmountCad,
        Number(row.stripe_fee_cad ?? 0),
        vendorEmail
      )
    } catch (emailErr) {
      console.error('Refund confirmation email error:', emailErr)
    }
  }

  return { ok: true }
}

/**
 * Fix bookings where Stripe issued a refund but DB status was never updated
 * (e.g. before `refunded` was allowed in bookings_status_check).
 */
export async function repairOrphanedStripeRefundsForVendor(
  admin: SupabaseClient,
  vendorId: string
): Promise<void> {
  const { data: orphans, error } = await admin
    .from('bookings')
    .select('id, stripe_payment_intent_id')
    .eq('vendor_id', vendorId)
    .in('status', ['confirmed', 'pending', 'booked'])
    .is('refunded_at', null)
    .not('stripe_payment_intent_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(25)

  if (error || !orphans?.length) return

  for (const row of orphans) {
    const pi = row.stripe_payment_intent_id as string | null
    if (!pi) continue
    const hasRefund = await paymentIntentHasSuccessfulRefund(pi)
    if (!hasRefund) continue
    const result = await processBookingRefund(admin, row.id as string, {
      initiatedBy: 'stripe_webhook',
      cancellationReason: 'Synced from Stripe refund',
      stripeAlreadyRefunded: true,
      skipRefundWindowCheck: true,
    })
    if (!result.ok) {
      console.error('repairOrphanedStripeRefundsForVendor:', row.id, result.error)
    }
  }
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
