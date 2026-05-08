import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Admin auth via Basic Auth header (same as /admin page)
  const authHeader = request.headers.get('authorization')
  const adminUser = process.env.ADMIN_USER
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminUser || !adminPassword) {
    return NextResponse.json({ error: 'Admin not configured' }, { status: 500 })
  }
  if (!authHeader?.startsWith('Basic ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8')
    const [u, p] = credentials.split(':')
    if (u !== adminUser || p !== adminPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const [
    { data: vendorsByStatus },
    { data: bookingStats },
    { data: recentVendors },
  ] = await Promise.all([
    admin
      .from('vendor_profiles')
      .select('status, created_at, trial_ends_at, subscription_current_period_end, stripe_connect_completed, cal_connected, first_session_created, business_name, slug')
      .order('created_at', { ascending: false }),
    admin
      .from('bookings')
      .select('id, amount_cad, created_at, status'),
    admin
      .from('vendor_profiles')
      .select('id, business_name, slug, status, trial_ends_at, subscription_current_period_end, stripe_connect_completed, cal_connected, first_session_created, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const vendors = vendorsByStatus ?? []
  const bookings = bookingStats ?? []

  // Vendor counts by status
  const statusCounts = vendors.reduce<Record<string, number>>((acc, v) => {
    acc[v.status] = (acc[v.status] ?? 0) + 1
    return acc
  }, {})

  const activeCount = (statusCounts['active'] ?? 0) + (statusCounts['trialing'] ?? 0)
  const mrr = (statusCounts['active'] ?? 0) * 79

  // 30-day churn
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const cancelledLast30 = vendors.filter(
    (v) => v.status === 'canceled' && v.created_at >= thirtyDaysAgo
  ).length
  const churnRate = activeCount > 0
    ? ((cancelledLast30 / activeCount) * 100).toFixed(1)
    : '0.0'

  // Booking stats
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const bookingsMtd = bookings.filter((b) => b.created_at >= startOfMonth && b.status !== 'refunded').length
  const gmv = bookings
    .filter((b) => b.status !== 'refunded')
    .reduce((sum, b) => sum + (b.amount_cad ?? 0), 0)
  const gmvMtd = bookings
    .filter((b) => b.created_at >= startOfMonth && b.status !== 'refunded')
    .reduce((sum, b) => sum + (b.amount_cad ?? 0), 0)

  // Per-vendor booking counts
  const { data: vendorBookingCounts } = await admin
    .from('bookings')
    .select('vendor_id')
  const bookingCountMap: Record<string, number> = {}
  for (const b of vendorBookingCounts ?? []) {
    if (b.vendor_id) bookingCountMap[b.vendor_id] = (bookingCountMap[b.vendor_id] ?? 0) + 1
  }

  // Session counts per vendor
  const { data: sessionCounts } = await admin
    .from('events')
    .select('vendor_profile_id')
    .neq('status', 'archived')
  const sessionCountMap: Record<string, number> = {}
  for (const s of sessionCounts ?? []) {
    if (s.vendor_profile_id) sessionCountMap[s.vendor_profile_id] = (sessionCountMap[s.vendor_profile_id] ?? 0) + 1
  }

  const vendorRows = (recentVendors ?? []).map((v) => ({
    ...v,
    bookings: bookingCountMap[v.id] ?? 0,
    sessions: sessionCountMap[v.id] ?? 0,
  }))

  return NextResponse.json({
    statusCounts,
    activeCount,
    mrr,
    churnRate,
    bookingsMtd,
    bookingsAllTime: bookings.filter((b) => b.status !== 'refunded').length,
    gmv,
    gmvMtd,
    vendors: vendorRows,
  })
}
