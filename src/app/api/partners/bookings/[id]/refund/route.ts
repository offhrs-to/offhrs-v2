import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

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
      amount_cad, status, refunded_at,
      events ( date )
    `)
    .eq('id', id)
    .eq('vendor_id', vendor.id)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status === 'refunded') return NextResponse.json({ error: 'Already refunded' }, { status: 409 })
  if (booking.status === 'cancelled') return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 409 })

  // Check refund window (platform minimum: 24h; vendor-configurable)
  const refundWindowHours = (vendor.refund_window_hours as number | null) ?? 48
  const sessionDate = (booking.events as { date?: string })?.date
  if (sessionDate) {
    const sessionStart = new Date(sessionDate)
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

  // Increment available_slots
  await admin.rpc('increment_available_slots', { booking_event_id: booking.event_id ?? '' }).maybeSingle()

  return NextResponse.json({ success: true })
}
