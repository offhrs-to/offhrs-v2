import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { computeSlotIncrementForEvent } from '@/lib/workshop-series'
import { syncVendorSessionToExternalCalendars } from '@/lib/vendor-calendar-sync'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id, refund_window_hours')
    .eq('user_id', user.id)
    .single()
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  const { data: booking } = await admin
    .from('bookings')
    .select(`
      id, vendor_id, event_id, stripe_payment_intent_id, stripe_charge_id,
      amount_cad, status, refunded_at, session_starts_at,
      events ( date, workshop_series, series_occurrences, available_slots, booking_status, max_attendees )
    `)
    .eq('id', id)
    .eq('vendor_id', vendor.id)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status === 'refunded') return NextResponse.json({ error: 'Already refunded' }, { status: 409 })
  if (booking.status === 'cancelled') return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 409 })

  // Check refund window (platform minimum: 24h; vendor-configurable)
  const refundWindowHours = (vendor.refund_window_hours as number | null) ?? 48
  const ev = booking.events as {
    date?: string
    workshop_series?: string
    series_occurrences?: unknown
    available_slots?: number
    booking_status?: string
    max_attendees?: number
  }
  const sessionDateIso = booking.session_starts_at ?? ev?.date
  if (sessionDateIso) {
    const sessionStart = new Date(sessionDateIso)
    const hoursUntilSession = (sessionStart.getTime() - Date.now()) / (1000 * 60 * 60)
    const minWindow = Math.max(refundWindowHours, 24)
    if (hoursUntilSession < minWindow) {
      return NextResponse.json(
        { error: `Refunds must be requested at least ${minWindow} hours before the session.` },
        { status: 403 }
      )
    }
  }

  // Issue Stripe refund
  if (booking.stripe_payment_intent_id) {
    try {
      await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stripe refund failed'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  }

  // Update booking record
  await admin
    .from('bookings')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      cancellation_reason: 'Refund issued by vendor',
    })
    .eq('id', id)

  const eventRow = {
    workshop_series: ev?.workshop_series,
    series_occurrences: ev?.series_occurrences,
    date: ev?.date ?? null,
    available_slots: ev?.available_slots,
    max_attendees: ev?.max_attendees,
    booking_status: ev?.booking_status,
  }
  const inc = computeSlotIncrementForEvent(
    eventRow,
    (booking.session_starts_at as string | null) ?? (ev?.date as string | null) ?? null
  )
  if (inc) {
    const eventUpdate: Record<string, unknown> = {
      available_slots: inc.available_slots,
      booking_status: inc.booking_status,
    }
    if (inc.series_occurrences) eventUpdate.series_occurrences = inc.series_occurrences
    await admin.from('events').update(eventUpdate).eq('id', booking.event_id ?? '')
    void syncVendorSessionToExternalCalendars(admin, vendor.id, String(booking.event_id ?? '')).catch(() => {})
  } else {
    await admin.rpc('increment_available_slots', { booking_event_id: booking.event_id ?? '' }).maybeSingle()
  }

  return NextResponse.json({ success: true })
}
