import { checkRefundWindowEligibility, getEffectiveRefundWindowHours } from '@/lib/booking-refund'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/book/refund-policy?event_id=123
 * Public refund/cancellation policy for a SaaS workshop (checkout display).
 */
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get('event_id')?.trim()
  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  const { data: event } = await admin
    .from('events')
    .select('id, vendor_profile_id, date, booking_status')
    .eq('id', eventId)
    .single()

  if (!event?.vendor_profile_id) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('refund_window_hours, business_name')
    .eq('id', event.vendor_profile_id)
    .single()

  const refundWindowHours = getEffectiveRefundWindowHours(
    (vendor?.refund_window_hours as number | null) ?? 48
  )

  const window = checkRefundWindowEligibility(null, event.date as string | null, refundWindowHours)

  return NextResponse.json({
    refundWindowHours,
    cancellableNow: window.eligible,
    hoursUntilSession: window.hoursUntilSession,
    policyLine: `Free cancellation with full refund up to ${refundWindowHours} hours before the session starts.`,
  })
}
