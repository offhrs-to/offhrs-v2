import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const ACTIVITY_DAYS = 14

export type PartnerNotificationDto = {
  id: string
  type:
    | 'booking_new'
    | 'booking_refund'
    | 'workshop_published'
    | 'workshop_reminder'
    | 'onboarding_tax_settings'
  title: string
  message: string
  createdAt: string
  href: string | null
}

function utcTomorrowWindow(): { start: string; end: string } {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const d = now.getUTCDate()
  const start = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(y, m, d + 2, 0, 0, 0, 0))
  return { start: start.toISOString(), end: new Date(end.getTime() - 1).toISOString() }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id, created_at, gst_hst_settings_confirmed_at')
      .eq('user_id', user.id)
      .single()
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    const vendorId = vendor.id as string
    const taxSettingsConfirmed = vendor.gst_hst_settings_confirmed_at != null
    const sinceMs = Date.now() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000
    const sinceDate = new Date(sinceMs)
    const sinceIso = sinceDate.toISOString()
    const { start: tomorrowStart, end: tomorrowEnd } = utcTomorrowWindow()

    const [bookingsRes, publishedRes, reminderRes] = await Promise.all([
      admin
        .from('bookings')
        .select(
          'id, name, status, created_at, refunded_at, amount_cad, net_vendor_cad, stripe_fee_cad, event_id, events ( title )'
        )
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(120),
      admin
        .from('events')
        .select('id, title, created_at, booking_status')
        .eq('vendor_profile_id', vendorId)
        .eq('booking_status', 'published')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(40),
      admin
        .from('events')
        .select('id, title, date, duration_minutes, booking_status')
        .eq('vendor_profile_id', vendorId)
        .in('booking_status', ['published', 'fully_booked'])
        .not('date', 'is', null)
        .gte('date', tomorrowStart)
        .lte('date', tomorrowEnd),
    ])

    const notifications: PartnerNotificationDto[] = []

    if (!taxSettingsConfirmed) {
      notifications.push({
        id: 'onboarding:tax_settings',
        type: 'onboarding_tax_settings',
        title: 'Set your workshop sales tax',
        message:
          'Open Settings → Workshop sales tax (GST/HST) and confirm whether you are registered with the CRA. If you are registered, enter your BN; if you are a small supplier, leave it off and save.',
        createdAt: (vendor.created_at as string) || new Date().toISOString(),
        href: '/partners/dashboard/settings',
      })
    }

    const cadFormatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' })

    for (const b of bookingsRes.data ?? []) {
      const evTitle = (b.events as { title?: string } | null)?.title ?? 'Workshop'
      const refundedAt = b.refunded_at ? new Date(b.refunded_at) : null
      if (refundedAt && refundedAt >= sinceDate) {
        // Surface the Stripe fee the vendor is absorbing: Stripe does not return its
        // processing fee on refunds, so per our Service Terms the vendor (not the
        // platform) bears that cost. Showing it inline keeps the policy transparent.
        const fee = Number(b.stripe_fee_cad ?? 0)
        const refundedAmount = b.amount_cad != null ? cadFormatter.format(Number(b.amount_cad)) : null
        const feeNote =
          fee > 0
            ? ` The Stripe processing fee of ${cadFormatter.format(fee)} on the original transaction is non-refundable by Stripe and remains the vendor's responsibility per our Service Terms.`
            : ''
        const refundClause = refundedAmount ? ` (${refundedAmount} refunded to the client)` : ''
        notifications.push({
          id: `booking:refund:${b.id}`,
          type: 'booking_refund',
          title: 'Booking refunded',
          message: `${b.name ?? 'A client'}'s booking for "${evTitle}" was refunded${refundClause}.${feeNote}`,
          createdAt: refundedAt.toISOString(),
          href: '/partners/dashboard/bookings',
        })
        continue
      }
      if ((b.status === 'confirmed' || b.status === 'pending') && new Date(b.created_at) >= sinceDate) {
        // Surface the vendor's net payout (post-Stripe-fee) - vendors absorb the fee per policy.
        const payoutAmount = b.net_vendor_cad ?? b.amount_cad
        const amt = payoutAmount != null ? cadFormatter.format(Number(payoutAmount)) : ''
        notifications.push({
          id: `booking:new:${b.id}`,
          type: 'booking_new',
          title: b.status === 'pending' ? 'New booking (pending)' : 'New booking',
          message:
            b.status === 'pending'
              ? `${b.name ?? 'Someone'} started booking "${evTitle}"${amt ? ` (${amt})` : ''}.`
              : `${b.name ?? 'Someone'} booked "${evTitle}"${amt ? ` (${amt})` : ''}.`,
          createdAt: new Date(b.created_at).toISOString(),
          href: '/partners/dashboard/bookings',
        })
      }
    }

    for (const ev of publishedRes.data ?? []) {
      notifications.push({
        id: `workshop:published:${ev.id}`,
        type: 'workshop_published',
        title: 'Workshop published',
        message: `"${ev.title ?? 'Untitled'}" is live as published.`,
        createdAt: new Date(ev.created_at as string).toISOString(),
        href: `/partners/dashboard/sessions?edit=${ev.id}`,
      })
    }

    for (const ev of reminderRes.data ?? []) {
      const when = ev.date ? new Date(ev.date as string).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }) : ''
      notifications.push({
        id: `workshop:reminder:${ev.id}`,
        type: 'workshop_reminder',
        title: 'Workshop tomorrow',
        message: `"${ev.title ?? 'Untitled'}" starts ${when || 'soon'} (UTC calendar day).`,
        createdAt: (ev.date as string) || new Date().toISOString(),
        href: `/partners/dashboard/calendar`,
      })
    }

    notifications.sort((a, b) => {
      const aOnboarding = a.type === 'onboarding_tax_settings' ? 1 : 0
      const bOnboarding = b.type === 'onboarding_tax_settings' ? 1 : 0
      if (aOnboarding !== bOnboarding) return bOnboarding - aOnboarding
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    const dedup = new Map<string, PartnerNotificationDto>()
    for (const n of notifications) {
      if (!dedup.has(n.id)) dedup.set(n.id, n)
    }
    const list = [...dedup.values()].slice(0, 50)

    return NextResponse.json({ notifications: list })
  } catch (err) {
    console.error('[notifications]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
