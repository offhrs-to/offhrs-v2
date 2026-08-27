import { repairOrphanedStripeRefundsForVendor } from '@/lib/booking-refund'
import { reconcileVendorEventSlots } from '@/lib/event-slot-reconcile'
import { archiveEndedPartnerSessions } from '@/lib/partner-session-auto-archive'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  await repairOrphanedStripeRefundsForVendor(admin, vendor.id)
  await reconcileVendorEventSlots(admin, vendor.id)
  await archiveEndedPartnerSessions(admin, vendor.id)

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const sessionId = searchParams.get('session_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const format = searchParams.get('format')

  let query = admin
    .from('bookings')
    .select(`
      id, name, email, amount_cad, subtotal_cad, tax_cad, total_cad, stripe_fee_cad, net_vendor_cad,
      stripe_payment_intent_id, stripe_charge_id,
      status, refunded_at, cancellation_reason, created_at, event_id,
      events ( title )
    `)
    .eq('vendor_id', vendor.id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (status && status !== 'all') query = query.eq('status', status)
  if (sessionId) query = query.eq('event_id', sessionId)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data: bookings, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (format === 'csv') {
    const rows = [
      ['ID', 'Attendee Name', 'Email', 'Session', 'Booking Date', 'Subtotal', 'Tax', 'Total', 'Stripe Fee', 'Net', 'Status', 'Charge ID'].join(','),
      ...(bookings ?? []).map((b) => [
        b.id,
        `"${(b.name ?? '').replace(/"/g, '""')}"`,
        b.email ?? '',
        `"${((b.events as { title?: string })?.title ?? '').replace(/"/g, '""')}"`,
        new Date(b.created_at).toISOString().slice(0, 10),
        b.subtotal_cad ?? b.amount_cad ?? '',
        b.tax_cad ?? '',
        b.total_cad ?? b.amount_cad ?? '',
        b.stripe_fee_cad ?? '',
        b.net_vendor_cad ?? '',
        b.status ?? '',
        b.stripe_charge_id ?? '',
      ].join(',')),
    ].join('\n')

    return new NextResponse(rows, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  return NextResponse.json({ bookings: bookings ?? [] })
}
