/**
 * POST /api/book/confirm
 * Called by the frontend after Stripe payment succeeds, or for free sessions (no PaymentIntent).
 * Inserts the booking row, decrements available slots, and sends confirmation emails.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import {
  deliverBookingConfirmationEmails,
  retryBookingConfirmationEmailsIfNeeded,
} from '@/lib/booking-confirm-emails'
import { computeSlotDecrementForEvent } from '@/lib/workshop-series'
import { syncVendorSessionToExternalCalendars } from '@/lib/vendor-calendar-sync'
import { commitWorkshopTaxTransaction } from '@/lib/stripe-workshop-tax'

/** Allow time to await Resend before the serverless function exits. */
export const maxDuration = 60

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

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

async function resolveApiUser(request: NextRequest) {
  const supabase = await createClient()
  let user = (await supabase.auth.getUser()).data.user
  const authHeader = request.headers.get('authorization')
  if (!user && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { createClient: createSupabase } = await import('@supabase/supabase-js')
    const client = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    user = (await client.auth.getUser()).data.user
  }
  return user
}

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
      const apiUser = await resolveApiUser(request)
      return handleFreeConfirm(admin, freeParsed.data, apiUser?.id ?? null)
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
    const subtotalCad = parseFloat(meta.subtotal_cad ?? meta.price_cad ?? '0')
    const taxCad = parseFloat(meta.tax_cad ?? '0')
    const totalCad = parseFloat(meta.total_cad ?? meta.price_cad ?? '0')
    const taxCalculationId = meta.tax_calculation?.trim() || null
    const connectedAccountId = meta.stripe_account_id?.trim() || null
    const piStartTime = startTime || meta.start_time

    // Idempotency — check if booking already exists for this PaymentIntent
    const { data: existingBooking } = await admin
      .from('bookings')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle()

    const appUserIdFromMeta = meta.app_user_id?.trim() || null

    if (existingBooking) {
      if (appUserIdFromMeta) {
        await admin
          .from('bookings')
          .update({ user_id: appUserIdFromMeta })
          .eq('id', existingBooking.id)
          .is('user_id', null)
      }
      let emailsSent = false
      let emailRetry = false
      try {
        const retry = await retryBookingConfirmationEmailsIfNeeded(admin, existingBooking.id)
        emailsSent = retry.emailsSent
        emailRetry = retry.retried
      } catch (emailErr) {
        console.error('Duplicate confirm email retry error:', emailErr)
      }
      return NextResponse.json({ success: true, duplicate: true, emailsSent, emailRetry })
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

    if (taxCalculationId && connectedAccountId) {
      try {
        await commitWorkshopTaxTransaction(stripe, {
          connectedAccountId,
          calculationId: taxCalculationId,
          reference: paymentIntentId,
        })
      } catch (taxTxErr) {
        console.error('Stripe Tax transaction commit error:', taxTxErr)
        return NextResponse.json(
          { error: 'Payment received but tax could not be recorded. Contact support with your receipt.' },
          { status: 500 }
        )
      }
    }

    const chargeAmountCad = totalCad > 0 ? totalCad : subtotalCad
    const stripeFee = Math.round((chargeAmountCad * 0.029 + 0.30) * 100) / 100
    const netVendor = Math.round((chargeAmountCad - stripeFee) * 100) / 100

    const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : (pi.latest_charge as { id: string } | null)?.id

    const appUserId = appUserIdFromMeta

    if (!appUserId) {
      return NextResponse.json(
        { error: 'Missing booker account on payment. Sign in and try again, or contact support with your receipt.' },
        { status: 422 }
      )
    }

    const { data: booking, error: insertError } = await admin
      .from('bookings')
      .insert({
        event_id: Number(eventId),
        vendor_id: vendorId,
        user_id: appUserId,
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: chargeId ?? null,
        name: attendeeName,
        email: attendeeEmail,
        status: 'confirmed',
        amount_cad: chargeAmountCad,
        subtotal_cad: subtotalCad,
        tax_cad: taxCad,
        total_cad: totalCad > 0 ? totalCad : chargeAmountCad,
        stripe_tax_calculation_id: taxCalculationId,
        stripe_fee_cad: stripeFee,
        net_vendor_cad: netVendor,
        ics_sent: false,
        session_starts_at: slot.sessionStartsAtIso,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Booking insert error:', insertError.message, insertError.details, insertError.code)
      const hint =
        insertError.code === '23514'
          ? 'Booking status rejected by database. Apply migration 20260518150000_saas_bookings_status_constraints.sql.'
          : insertError.code === '42703'
            ? 'Bookings table missing SaaS columns. Apply Supabase migrations for bookings tax and status.'
            : null
      return NextResponse.json(
        {
          error: hint ?? 'Failed to record booking',
          detail: process.env.NODE_ENV === 'development' ? insertError.message : undefined,
        },
        { status: 500 }
      )
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

    let emailsSent = false
    try {
      await deliverBookingConfirmationEmails(
        admin,
        {
          id: booking.id,
          email: attendeeEmail ?? '',
          name: attendeeName ?? '',
          session_starts_at: slot.sessionStartsAtIso,
        },
        event,
        vendorProfile,
        vendorEmail,
        { amountCad: chargeAmountCad, fullyBooked: slot.booking_status === 'fully_booked' }
      )
      emailsSent = true
    } catch (emailErr) {
      console.error('Booking confirmation email error:', emailErr)
    }

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      fullyBooked: slot.booking_status === 'fully_booked',
      emailsSent,
    })
  } catch (err) {
    console.error('Book confirm error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleFreeConfirm(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  data: z.infer<typeof freeConfirmSchema>,
  appUserId: string | null
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
    if (appUserId) {
      await admin
        .from('bookings')
        .update({ user_id: appUserId })
        .eq('id', existing.id)
        .is('user_id', null)
    }
    let emailsSent = false
    let emailRetry = false
    try {
      const retry = await retryBookingConfirmationEmailsIfNeeded(admin, existing.id)
      emailsSent = retry.emailsSent
      emailRetry = retry.retried
    } catch (emailErr) {
      console.error('Duplicate free confirm email retry error:', emailErr)
    }
    return NextResponse.json({ success: true, duplicate: true, emailsSent, emailRetry })
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
      user_id: appUserId,
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

  let emailsSent = false
  try {
    await deliverBookingConfirmationEmails(
      admin,
      {
        id: booking.id,
        email: attendee_email,
        name: attendee_name,
        session_starts_at: slot.sessionStartsAtIso,
      },
      event,
      vendorProfile,
      vendorEmail,
      { amountCad: 0, fullyBooked: slot.booking_status === 'fully_booked' }
    )
    emailsSent = true
  } catch (emailErr) {
    console.error('Booking confirmation email error:', emailErr)
  }

  return NextResponse.json({
    success: true,
    bookingId: booking.id,
    fullyBooked: slot.booking_status === 'fully_booked',
    emailsSent,
  })
}
