import { checkRefundWindowEligibility } from '@/lib/booking-refund'
import {
  buildConsumerRefundPolicyDisplay,
  resolveVendorRefundPolicy,
} from '@/lib/vendor-refund-policy'
import { createAdminClient } from '@/lib/supabase/admin'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { logSecurityEvent } from '@/lib/security-monitor'
import { NextRequest, NextResponse } from 'next/server'

const REFUND_POLICY_RATE_LIMIT = 60 // per minute per IP

/**
 * GET /api/book/refund-policy?event_id=123
 * Public refund/cancellation policy for a SaaS workshop (checkout display).
 */
export async function GET(request: NextRequest) {
  const rlKey = getRateLimitKey(request)
  const rl = consumeRateLimit(`refund-policy:${rlKey}`, REFUND_POLICY_RATE_LIMIT)
  if (!rl.allowed) {
    logSecurityEvent('warn', { type: 'rate_limited', route: '/api/book/refund-policy', ipKey: rlKey })
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

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
    .select('refund_window_hours, strict_no_refund, business_name')
    .eq('id', event.vendor_profile_id)
    .single()

  const policy = resolveVendorRefundPolicy(vendor ?? {})
  const display = buildConsumerRefundPolicyDisplay(vendor ?? {})

  const window = policy.strictNoRefund
    ? { eligible: false, hoursUntilSession: null }
    : checkRefundWindowEligibility(
        null,
        event.date as string | null,
        policy.refundWindowHours
      )

  return NextResponse.json({
    strictNoRefund: display.strictNoRefund,
    refundWindowHours: display.refundWindowHours,
    badge: display.badge,
    policyHeadline: display.policyHeadline,
    policyLine: display.policyLine,
    refundPolicyLine: display.policyLine,
    summary: display.summary,
    detailBullets: display.detailBullets,
    exceptionLine: display.exceptionLine,
    beforeBookLine: display.beforeBookLine,
    platformFooter: display.platformFooter,
    ackLabel: display.ackLabel,
    myBookingsNote: display.myBookingsNote,
    emailSummaryLine: display.emailSummaryLine,
    cancellableNow: window.eligible,
    hoursUntilSession: window.hoursUntilSession,
  })
}
