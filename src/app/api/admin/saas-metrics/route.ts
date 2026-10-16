import { verifyAdmin } from '@/app/api/admin/login/route'
import { monthlyCadForTier } from '@/lib/stripe-partner-plans'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

type SubRow = {
  vendor_id: string
  subscription_tier: string | null
  status: string
  updated_at?: string | null
}

const SUB_STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  trialing: 1,
  past_due: 2,
  unpaid: 3,
  incomplete: 4,
  canceled: 5,
  incomplete_expired: 6,
}

function pickBestSubscription(rows: SubRow[]): SubRow | null {
  if (rows.length === 0) return null
  return [...rows].sort((a, b) => {
    const pa = SUB_STATUS_PRIORITY[a.status] ?? 99
    const pb = SUB_STATUS_PRIORITY[b.status] ?? 99
    if (pa !== pb) return pa - pb
    return (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
  })[0]
}

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const [
    { data: vendorsByStatus },
    { data: bookingStats },
    { data: recentVendors },
    { data: activeSubscriptions },
  ] = await Promise.all([
    admin
      .from('vendor_profiles')
      .select('status, created_at, trial_ends_at, subscription_current_period_end, stripe_connect_completed, first_session_created, business_name, slug')
      .order('created_at', { ascending: false }),
    admin
      .from('bookings')
      .select('id, amount_cad, created_at, status'),
    admin
      .from('vendor_profiles')
      .select(
        'id, user_id, business_name, slug, status, trial_ends_at, subscription_current_period_end, stripe_connect_completed, first_session_created, created_at, marketplace_enabled, marketplace_plan'
      )
      .order('created_at', { ascending: false })
      .limit(50),
    admin.from('vendor_subscriptions').select('subscription_tier').eq('status', 'active'),
  ])

  const vendors = vendorsByStatus ?? []
  const bookings = bookingStats ?? []
  const recent = recentVendors ?? []

  // Vendor counts by status
  const statusCounts = vendors.reduce<Record<string, number>>((acc, v) => {
    acc[v.status] = (acc[v.status] ?? 0) + 1
    return acc
  }, {})

  const activeCount = (statusCounts['active'] ?? 0) + (statusCounts['trialing'] ?? 0)
  const mrr = (activeSubscriptions ?? []).reduce((sum, sub) => {
    const raw = sub.subscription_tier
    const tier = raw === 'lite' || raw === 'full' || raw === 'pro' ? raw : 'pro'
    return sum + monthlyCadForTier(tier)
  }, 0)

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
    .neq('booking_status', 'archived')
  const sessionCountMap: Record<string, number> = {}
  for (const s of sessionCounts ?? []) {
    if (s.vendor_profile_id) sessionCountMap[s.vendor_profile_id] = (sessionCountMap[s.vendor_profile_id] ?? 0) + 1
  }

  const vendorIds = recent.map((v) => v.id)
  const subByVendor = new Map<string, SubRow>()
  if (vendorIds.length > 0) {
    const { data: subs } = await admin
      .from('vendor_subscriptions')
      .select('vendor_id, subscription_tier, status, updated_at')
      .in('vendor_id', vendorIds)

    const grouped = new Map<string, SubRow[]>()
    for (const row of (subs ?? []) as SubRow[]) {
      const list = grouped.get(row.vendor_id) ?? []
      list.push(row)
      grouped.set(row.vendor_id, list)
    }
    for (const [vendorId, list] of grouped) {
      const best = pickBestSubscription(list)
      if (best) subByVendor.set(vendorId, best)
    }
  }

  const uniqueUserIds = [...new Set(recent.map((v) => v.user_id).filter(Boolean))] as string[]
  const emailByUserId = new Map<string, string>()
  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      try {
        const { data } = await admin.auth.admin.getUserById(userId)
        const email = data?.user?.email?.trim()
        if (email) emailByUserId.set(userId, email)
      } catch {
        // skip — leave email blank
      }
    })
  )

  const vendorRows = recent.map((v) => {
    const sub = subByVendor.get(v.id)
    const tier = sub?.subscription_tier
    const plan =
      tier === 'lite' || tier === 'pro' || tier === 'full' ? tier : null
    let marketplace: 'free' | 'included' | 'on' | 'off' = 'off'
    if (v.marketplace_enabled) {
      if (v.marketplace_plan === 'included') marketplace = 'included'
      else if (v.marketplace_plan === 'free') marketplace = 'free'
      else marketplace = 'on'
    }

    return {
      id: v.id,
      business_name: v.business_name,
      slug: v.slug,
      status: v.status,
      trial_ends_at: v.trial_ends_at,
      subscription_current_period_end: v.subscription_current_period_end,
      stripe_connect_completed: v.stripe_connect_completed,
      first_session_created: v.first_session_created,
      created_at: v.created_at,
      bookings: bookingCountMap[v.id] ?? 0,
      sessions: sessionCountMap[v.id] ?? 0,
      plan,
      subscription_status: sub?.status ?? null,
      marketplace,
      marketplace_enabled: Boolean(v.marketplace_enabled),
      email: (v.user_id && emailByUserId.get(v.user_id)) || null,
    }
  })

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
