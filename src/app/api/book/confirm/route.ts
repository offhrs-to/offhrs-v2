/**
 * POST /api/book/confirm
 * Called by the frontend after Stripe payment succeeds, or for free sessions (no PaymentIntent).
 * Inserts the booking row, decrements available slots, and sends confirmation emails.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { sendConsumerBookingConfirmation, sendVendorBookingNotification, sendVendorFullyBooked } from '@/lib/emails'
import { computeSlotDecrementForEvent } from '@/lib/workshop-series'
import { syncVendorSessionToExternalCalendars } from '@/lib/vendor-calendar-sync'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

const paidConfirmSchema = z.object({
  paymentIntentId: z.string().min(1),
  startTime: z.string().optional(),
})

const freeConfirmSchema = z.object({
  free: z.literal(true),
  event_id: z.string(),
  attendee_name: z.string().min(1).max(120),
  attendee_email: z.string().email(),
  startTime: z.string().optional(),
})

function resolveSessionDate(
  startTime: string | undefined,
  metaStart: string | undefined,
  eventDateIso: string | null | undefined
): Date {
  const raw = startTime || metaStart || eventDateIso
  if (raw) {
    const d = new Date(raw)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json()
    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const freeParsed = freeConfirmSchema.safeParse(raw)
    if (freeParsed.success) {
      return handleFreeConfirm(admin, freeParsed.data)
    }

    const paidParsed = paidConfirmSchema.safeParse(raw)
    if (!paidParsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { paymentIntentId, startTime } = paidParsed.data

    // Verify PaymentIntent succeeded
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (pi.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 422 })
    }

    const meta = pi.metadata
    const eventId = meta.event_id
    const vendorId = meta.vendor_id
    const attendeeName = meta.attendee_name
    const attendeeEmail = meta.attendee_email
    const priceCad = parseFloat(meta.price_cad ?? '0')
    const piStartTime = startTime || meta.start_time

    // Idempotency — check if booking already exists for this PaymentIntent
    const { data: existingBooking } = await admin
      .from('bookings')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle()

    if (existingBooking) {
      return NextResponse.json({ success: true, duplicate: true })
    }

    const { data: event } = await admin
      .from('events')
      .select(
        'id, title, available_slots, max_attendees, duration_minutes, location, booking_status, vendor_profile_id, date, workshop_series, series_occurrences'
      )
      .eq('id', eventId)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const slot = computeSlotDecrementForEvent(event, startTime, piStartTime)
    if (!slot.ok) {
      return NextResponse.json({ error: slot.error }, { status: 409 })
    }

    const { data: vendorProfile } = await admin
      .from('vendor_profiles')
      .select('business_name, website_url, user_id')
      .eq('id', vendorId)
      .single()

    const vendorEmail = await (async () => {
      if (!vendorProfile?.user_id) return null
      const { data: authUser } = await admin.auth.admin.getUserById(vendorProfile.user_id)
      return authUser?.user?.email ?? null
    })()

    const stripeFee = Math.round((priceCad * 0.029 + 0.30) * 100) / 100
    const netVendor = Math.round((priceCad - stripeFee) * 100) / 100

    const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : (pi.latest_charge as { id: string } | null)?.id

    const { data: booking, error: insertError } = await admin
      .from('bookings')
      .insert({
        event_id: eventId,
        vendor_id: vendorId,
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: chargeId ?? null,
        name: attendeeName,
        email: attendeeEmail,
        status: 'confirmed',
        amount_cad: priceCad,
        stripe_fee_cad: stripeFee,
        net_vendor_cad: netVendor,
        ics_sent: false,
        session_starts_at: slot.sessionStartsAtIso,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Booking insert error:', insertError)
      return NextResponse.json({ error: 'Failed to record booking' }, { status: 500 })
    }

    const eventUpdate: Record<string, unknown> = {
      available_slots: slot.available_slots,
      booking_status: slot.booking_status,
    }
    if (slot.series_occurrences) {
      eventUpdate.series_occurrences = slot.series_occurrences
    }

    await admin.from('events').update(eventUpdate).eq('id', eventId)

    void syncVendorSessionToExternalCalendars(admin, vendorId, String(eventId)).catch(() => {})

    const sessionDate = new Date(slot.sessionStartsAtIso)
    const durationMinutes = (event.duration_minutes ?? 60) as number

    const emailParams = {
      attendeeName: attendeeName ?? '',
      attendeeEmail: attendeeEmail ?? '',
      sessionTitle: event.title,
      vendorName: vendorProfile?.business_name ?? 'offhrs',
      sessionDate,
      durationMinutes,
      location: event.location,
      vendorWebsite: vendorProfile?.website_url ?? null,
      bookingRef: booking.id,
      amountCad: priceCad,
    }

    Promise.all([
      sendConsumerBookingConfirmation(emailParams),
      vendorEmail
        ? sendVendorBookingNotification(vendorEmail, {
            businessName: vendorProfile?.business_name ?? 'offhrs',
            attendeeName: attendeeName ?? '',
            attendeeEmail: attendeeEmail ?? '',
            sessionTitle: event.title,
            sessionDate: sessionDate.toLocaleDateString('en-CA', {
              weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            }),
            amountCad: priceCad,
            dashboardUrl: `${APP_URL}/partners/dashboard/bookings`,
          })
        : Promise.resolve(),
      slot.booking_status === 'fully_booked' && vendorEmail
        ? sendVendorFullyBooked(vendorEmail, event.title, `${APP_URL}/partners/dashboard/bookings`)
        : Promise.resolve(),
    ])
      .then(async () => {
        await admin.from('bookings').update({ ics_sent: true }).eq('id', booking.id)
      })
      .catch(console.error)

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      fullyBooked: slot.booking_status === 'fully_booked',
    })
  } catch (err) {
    console.error('Book confirm error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleFreeConfirm(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  data: z.infer<typeof freeConfirmSchema>
) {
  const { event_id, attendee_name, attendee_email, startTime } = data

  const { data: existing } = await admin
    .from('bookings')
    .select('id')
    .eq('event_id', event_id)
    .eq('email', attendee_email)
    .eq('status', 'confirmed')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ success: true, duplicate: true })
  }

  const { data: event } = await admin
    .from('events')
    .select(
      'id, title, available_slots, max_attendees, duration_minutes, location, booking_status, vendor_profile_id, price_cad, date, workshop_series, series_occurrences'
    )
    .eq('id', event_id)
    .single()

  if (!event?.vendor_profile_id) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  if ((event.price_cad ?? 0) > 0) {
    return NextResponse.json({ error: 'This session requires payment' }, { status: 409 })
  }

  if (event.booking_status === 'fully_booked') {
    return NextResponse.json({ error: 'This session is fully booked' }, { status: 409 })
  }

  if (event.booking_status !== 'published') {
    return NextResponse.json({ error: 'This session is not available for booking' }, { status: 409 })
  }

  if ((event.available_slots ?? 0) <= 0) {
    return NextResponse.json({ error: 'No spots remaining' }, { status: 409 })
  }

  const slot = computeSlotDecrementForEvent(event, startTime, undefined)
  if (!slot.ok) {
    return NextResponse.json({ error: slot.error }, { status: 409 })
  }

  const vendorId = event.vendor_profile_id

  const { data: vendorProfile } = await admin
    .from('vendor_profiles')
    .select('business_name, website_url, user_id')
    .eq('id', vendorId)
    .single()

  const vendorEmail = await (async () => {
    if (!vendorProfile?.user_id) return null
    const { data: authUser } = await admin.auth.admin.getUserById(vendorProfile.user_id)
    return authUser?.user?.email ?? null
  })()

  const { data: booking, error: insertError } = await admin
    .from('bookings')
    .insert({
      event_id,
      vendor_id: vendorId,
      stripe_payment_intent_id: null,
      stripe_charge_id: null,
      name: attendee_name,
      email: attendee_email,
      status: 'confirmed',
      amount_cad: 0,
      stripe_fee_cad: 0,
      net_vendor_cad: 0,
      ics_sent: false,
      session_starts_at: slot.sessionStartsAtIso,
    })
    .select()
    .single()

  if (insertError) {
    console.error('Free booking insert error:', insertError)
    return NextResponse.json({ error: 'Failed to record booking' }, { status: 500 })
  }

  const eventUpdate: Record<string, unknown> = {
    available_slots: slot.available_slots,
    booking_status: slot.booking_status,
  }
  if (slot.series_occurrences) {
    eventUpdate.series_occurrences = slot.series_occurrences
  }

  await admin.from('events').update(eventUpdate).eq('id', event_id)

  void syncVendorSessionToExternalCalendars(admin, vendorId, String(event_id)).catch(() => {})

  const sessionDate = new Date(slot.sessionStartsAtIso)
  const durationMinutes = (event.duration_minutes ?? 60) as number

  const emailParams = {
    attendeeName: attendee_name,
    attendeeEmail: attendee_email,
    sessionTitle: event.title,
    vendorName: vendorProfile?.business_name ?? 'offhrs',
    sessionDate,
    durationMinutes,
    location: event.location,
    vendorWebsite: vendorProfile?.website_url ?? null,
    bookingRef: booking.id,
    amountCad: 0,
  }

  Promise.all([
    sendConsumerBookingConfirmation(emailParams),
    vendorEmail
      ? sendVendorBookingNotification(vendorEmail, {
          businessName: vendorProfile?.business_name ?? 'offhrs',
          attendeeName: attendee_name,
          attendeeEmail: attendee_email,
          sessionTitle: event.title,
          sessionDate: sessionDate.toLocaleDateString('en-CA', {
            weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          }),
          amountCad: 0,
          dashboardUrl: `${APP_URL}/partners/dashboard/bookings`,
        })
      : Promise.resolve(),
    slot.booking_status === 'fully_booked' && vendorEmail
      ? sendVendorFullyBooked(vendorEmail, event.title, `${APP_URL}/partners/dashboard/bookings`)
      : Promise.resolve(),
  ])
    .then(async () => {
      await admin.from('bookings').update({ ics_sent: true }).eq('id', booking.id)
    })
    .catch(console.error)

  return NextResponse.json({
    success: true,
    bookingId: booking.id,
    fullyBooked: slot.booking_status === 'fully_booked',
  })
}
