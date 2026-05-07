import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import Stripe from 'stripe'
import {
  sendConsumerBookingCancelled,
  sendConsumerBookingRescheduled,
  sendConsumerRefundConfirmation,
  sendVendorBookingNotification,
  sendVendorFullyBooked,
  type BookingEmailParams,
} from '@/lib/emails'

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil',
})

function verifyCalSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.CAL_WEBHOOK_SECRET
  if (!secret) return true // Skip in dev if not set
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  return `sha256=${expected}` === signature
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-cal-signature-256') ?? ''

  if (!verifyCalSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const payload = JSON.parse(rawBody)
  const eventType: string = payload.triggerEvent ?? payload.type ?? ''

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // Idempotency — use Cal's unique booking uid
  const bookingUid: string = payload.payload?.uid ?? payload.uid ?? ''
  const eventId = `cal:${eventType}:${bookingUid}`

  if (bookingUid) {
    const { data: existing } = await admin
      .from('webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ received: true, duplicate: true })
    }

    await admin.from('webhook_events').insert({
      source: 'cal',
      event_id: eventId,
      event_type: eventType,
      payload: payload as Record<string, unknown>,
    })
  }

  try {
    switch (eventType) {
      case 'BOOKING_CREATED':
        await handleBookingCreated(payload, admin)
        break
      case 'BOOKING_CANCELLED':
        await handleBookingCancelled(payload, admin)
        break
      case 'BOOKING_RESCHEDULED':
        await handleBookingRescheduled(payload, admin)
        break
      default:
        break
    }

    if (bookingUid) {
      await admin
        .from('webhook_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('event_id', eventId)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Cal webhook handler error (${eventType}):`, err)
    if (bookingUid) {
      await admin
        .from('webhook_events')
        .update({ error: message })
        .eq('event_id', eventId)
    }
  }

  return NextResponse.json({ received: true })
}

async function handleBookingCreated(
  payload: Record<string, unknown>,
  admin: NonNullable<ReturnType<typeof createAdminClient>>
) {
  const booking = (payload.payload ?? payload) as Record<string, unknown>
  const calBookingUid = booking.uid as string
  const startTime = booking.startTime as string
  const eventTypeId = String((booking.eventTypeId ?? booking.eventType?.id) ?? '')

  if (!calBookingUid || !startTime || !eventTypeId) return

  // Find the event by cal_event_type_id
  const { data: event } = await admin
    .from('events')
    .select('id, title, vendor_profile_id, duration_minutes, location, available_slots, max_attendees, price_cad, status')
    .eq('cal_event_type_id', eventTypeId)
    .maybeSingle()

  if (!event) return

  const attendee = ((booking.attendees as Record<string, unknown>[])?.[0] ?? {}) as Record<string, unknown>
  const attendeeName = (attendee.name as string) ?? 'Guest'
  const attendeeEmail = (attendee.email as string) ?? ''

  // Check if booking already exists (from payment webhook)
  const { data: existingBooking } = await admin
    .from('bookings')
    .select('id')
    .eq('cal_booking_uid', calBookingUid)
    .maybeSingle()

  if (!existingBooking) {
    // Insert booking row (for free sessions or sessions booked directly via Cal.com)
    await admin.from('bookings').insert({
      event_id: event.id,
      vendor_id: event.vendor_profile_id,
      cal_booking_uid: calBookingUid,
      name: attendeeName,
      email: attendeeEmail,
      status: 'confirmed',
      amount_cad: 0,
    })
  }

  // Decrement available slots
  if (event.available_slots !== null && event.available_slots > 0) {
    const newSlots = event.available_slots - 1
    const newStatus = newSlots === 0 ? 'fully_booked' : event.status

    await admin
      .from('events')
      .update({ available_slots: newSlots, status: newStatus })
      .eq('id', event.id)

    // Notify vendor if fully booked
    if (newSlots === 0) {
      const { data: vendorProfile } = await admin
        .from('vendor_profiles')
        .select('user_id')
        .eq('id', event.vendor_profile_id)
        .single()

      if (vendorProfile) {
        const { data: authUser } = await admin.auth.admin.getUserById(vendorProfile.user_id)
        if (authUser?.user?.email) {
          await sendVendorFullyBooked(authUser.user.email, event.title, `${APP_URL}/partners/dashboard/bookings`)
        }
      }
    }
  }

  // Send vendor booking notification
  const { data: vendorProfile } = await admin
    .from('vendor_profiles')
    .select('user_id, business_name')
    .eq('id', event.vendor_profile_id)
    .single()

  if (vendorProfile) {
    const { data: authUser } = await admin.auth.admin.getUserById(vendorProfile.user_id)
    if (authUser?.user?.email) {
      await sendVendorBookingNotification(authUser.user.email, {
        businessName: vendorProfile.business_name,
        attendeeName,
        attendeeEmail,
        sessionTitle: event.title,
        sessionDate: new Date(startTime).toLocaleDateString('en-CA', {
          weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        }),
        amountCad: (event.price_cad ?? 0) as number,
        dashboardUrl: `${APP_URL}/partners/dashboard/bookings`,
      })
    }
  }
}

async function handleBookingCancelled(
  payload: Record<string, unknown>,
  admin: NonNullable<ReturnType<typeof createAdminClient>>
) {
  const booking = (payload.payload ?? payload) as Record<string, unknown>
  const calBookingUid = booking.uid as string
  if (!calBookingUid) return

  const { data: bookingRow } = await admin
    .from('bookings')
    .select('id, name, email, amount_cad, event_id, stripe_payment_intent_id, refunded_at')
    .eq('cal_booking_uid', calBookingUid)
    .maybeSingle()

  if (!bookingRow) return

  // Mark as cancelled
  await admin
    .from('bookings')
    .update({ status: 'cancelled', cancellation_reason: (booking.cancellationReason as string) ?? null })
    .eq('id', bookingRow.id)

  // Restore slot
  const { data: event } = await admin
    .from('events')
    .select('id, title, available_slots, max_attendees, location, duration_minutes, vendor_profile_id')
    .eq('id', bookingRow.event_id)
    .single()

  if (event) {
    const newSlots = Math.min((event.available_slots ?? 0) + 1, event.max_attendees ?? 999)
    await admin
      .from('events')
      .update({
        available_slots: newSlots,
        status: newSlots > 0 ? 'published' : 'fully_booked',
      })
      .eq('id', event.id)

    const { data: vendorProfile } = await admin
      .from('vendor_profiles')
      .select('business_name, refund_window_hours')
      .eq('id', event.vendor_profile_id)
      .single()

    if (bookingRow.email) {
      const startTime = (booking.startTime as string) ?? ''
      const sessionDate = startTime ? new Date(startTime) : new Date()
      const durationMinutes = (event.duration_minutes ?? 60) as number

      const emailParams: BookingEmailParams = {
        attendeeName: (bookingRow.name as string) ?? 'Guest',
        attendeeEmail: bookingRow.email as string,
        sessionTitle: event.title,
        vendorName: vendorProfile?.business_name ?? 'offhrs',
        sessionDate,
        durationMinutes,
        location: event.location,
        vendorWebsite: null,
        bookingRef: calBookingUid,
        amountCad: (bookingRow.amount_cad ?? 0) as number,
      }

      await sendConsumerBookingCancelled(emailParams)
    }

    // Issue refund if eligible + not already refunded
    const amountCad = (bookingRow.amount_cad ?? 0) as number
    const stripePaymentIntentId = bookingRow.stripe_payment_intent_id as string | null
    const refundWindowHours = (vendorProfile?.refund_window_hours ?? 48) as number
    const startTime = (booking.startTime as string) ?? ''
    const sessionDate = startTime ? new Date(startTime) : null
    const alreadyRefunded = !!bookingRow.refunded_at

    if (
      !alreadyRefunded &&
      stripePaymentIntentId &&
      amountCad > 0 &&
      sessionDate &&
      Date.now() < sessionDate.getTime() - refundWindowHours * 60 * 60 * 1000
    ) {
      try {
        const pi = await stripe.paymentIntents.retrieve(stripePaymentIntentId)
        const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id
        if (chargeId) {
          await stripe.refunds.create({ charge: chargeId })
          await admin
            .from('bookings')
            .update({ refunded_at: new Date().toISOString() })
            .eq('id', bookingRow.id)

          await sendConsumerRefundConfirmation(
            bookingRow.email as string,
            (bookingRow.name as string) ?? 'Guest',
            event.title,
            amountCad,
            calBookingUid
          )
        }
      } catch (refundErr) {
        console.error('Refund failed:', refundErr)
      }
    }
  }
}

async function handleBookingRescheduled(
  payload: Record<string, unknown>,
  admin: NonNullable<ReturnType<typeof createAdminClient>>
) {
  const booking = (payload.payload ?? payload) as Record<string, unknown>
  const calBookingUid = booking.uid as string
  const newStartTime = (booking.startTime ?? booking.newStartTime) as string
  const previousStartTime = (booking.previousStartTime ?? booking.prevStartTime) as string

  if (!calBookingUid || !newStartTime) return

  const { data: bookingRow } = await admin
    .from('bookings')
    .select('id, name, email, amount_cad, event_id')
    .eq('cal_booking_uid', calBookingUid)
    .maybeSingle()

  if (!bookingRow) return

  // Update booking date
  await admin
    .from('bookings')
    .update({ created_at: new Date().toISOString() })
    .eq('id', bookingRow.id)

  const { data: event } = await admin
    .from('events')
    .select('title, location, duration_minutes, vendor_profile_id')
    .eq('id', bookingRow.event_id)
    .single()

  if (!event || !bookingRow.email) return

  const { data: vendorProfile } = await admin
    .from('vendor_profiles')
    .select('business_name, website_url')
    .eq('id', event.vendor_profile_id)
    .single()

  const emailParams: BookingEmailParams = {
    attendeeName: (bookingRow.name as string) ?? 'Guest',
    attendeeEmail: bookingRow.email as string,
    sessionTitle: event.title,
    vendorName: vendorProfile?.business_name ?? 'offhrs',
    sessionDate: new Date(newStartTime),
    durationMinutes: (event.duration_minutes ?? 60) as number,
    location: event.location,
    vendorWebsite: vendorProfile?.website_url ?? null,
    bookingRef: calBookingUid,
    amountCad: (bookingRow.amount_cad ?? 0) as number,
  }

  await sendConsumerBookingRescheduled(
    emailParams,
    previousStartTime ? new Date(previousStartTime) : new Date()
  )
}
