import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AlertTriangle, CalendarDays, Users, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { ConnectStripeButton } from './components/ConnectStripeButton'
import { PartnerDashboardHeaderActions } from './components/PartnerDashboardHeaderActions'
import { DashboardActivityChart } from './components/DashboardActivityChart'
import { buildActivitySeriesFromBookings, type BookingActivityRow } from '@/lib/partner-dashboard-activity'

interface VendorProfile {
  id: string
  business_name: string
  bio: string | null
  status: string
  email_verified: boolean
  stripe_checkout_completed: boolean
  stripe_connect_completed: boolean
  first_session_created: boolean
  trial_ends_at: string | null
  subscription_current_period_end: string | null
}

function daysUntil(date: string | null): number | null {
  if (!date) return null
  const diff = new Date(date).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function formatCad(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount)
}

function formatSessionDate(iso: string | null): string {
  if (!iso) return 'Date TBD'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Date TBD'
  return d.toLocaleString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDurationMinutes(minutes: number | null): string {
  if (minutes == null || minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return h === 1 ? '1 hr' : `${h} hr`
  return `${h} hr ${m} min`
}

function spotsFilledLabel(maxAttendees: number | null, availableSlots: number | null): string {
  const cap = maxAttendees ?? 0
  if (cap <= 0) return 'Capacity not set'
  const remaining = availableSlots ?? cap
  const filled = Math.max(0, Math.min(cap, cap - remaining))
  return `${filled} of ${cap} spots filled`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/partners/login')

  const admin = createAdminClient()
  if (!admin) return <div className="p-8 text-red-500">Server configuration error</div>

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single() as { data: VendorProfile | null }

  if (!vendor) redirect('/partners/signup')

  // KPI data
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const activityWindow = new Date(now.getTime() - 30 * 86400000).toISOString()

  const [
    sessionsRes,
    bookingsRes,
    recentBookingsRes,
    vendorSessionsRes,
    activityCreatedRes,
    activityRefundRes,
    capacityRes,
  ] = await Promise.all([
    admin
      .from('events')
      .select('id', { count: 'exact' })
      .eq('vendor_profile_id', vendor.id)
      .in('booking_status', ['published', 'fully_booked']),
    admin
      .from('bookings')
      .select('amount_cad')
      .eq('vendor_id', vendor.id)
      .gte('created_at', monthStart),
    admin
      .from('bookings')
      .select('id, name, session_title:event_id(title), created_at, amount_cad, status')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false })
      .limit(5),
    admin
      .from('events')
      .select('id, title, date, max_attendees, available_slots, duration_minutes, booking_status')
      .eq('vendor_profile_id', vendor.id)
      .order('date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('bookings')
      .select('id, created_at, status, refunded_at')
      .eq('vendor_id', vendor.id)
      .gte('created_at', activityWindow),
    admin
      .from('bookings')
      .select('id, created_at, status, refunded_at')
      .eq('vendor_id', vendor.id)
      .not('refunded_at', 'is', null)
      .gte('refunded_at', activityWindow),
    admin
      .from('events')
      .select('available_slots')
      .eq('vendor_profile_id', vendor.id)
      .in('booking_status', ['published', 'fully_booked']),
  ])

  const activeSessions = sessionsRes.count ?? 0
  const monthlyBookings = bookingsRes.data?.length ?? 0
  const monthlyRevenue = bookingsRes.data?.reduce((sum: number, b: { amount_cad?: number | null }) => sum + (b.amount_cad ?? 0), 0) ?? 0

  const profileBioComplete = Boolean(vendor.bio?.trim())

  const checklistItems = [
    { key: 'email_verified', label: 'Verify your email', done: vendor.email_verified, showStripeCta: false, href: null as string | null },
    { key: 'stripe_checkout_completed', label: 'Start free trial', done: vendor.stripe_checkout_completed, showStripeCta: false, href: null },
    {
      key: 'stripe_connect_completed',
      label: 'Set up payout account (Stripe)',
      done: vendor.stripe_connect_completed,
      showStripeCta: !vendor.stripe_connect_completed,
      href: null,
    },
    {
      key: 'profile_settings_reviewed',
      label: 'Review Settings & add your bio',
      done: profileBioComplete,
      showStripeCta: false,
      href: profileBioComplete ? null : '/partners/dashboard/settings',
    },
    {
      key: 'first_session_created',
      label: 'Create your first workshop',
      done: vendor.first_session_created,
      showStripeCta: false,
      href: '/partners/dashboard/sessions?new=1',
    },
  ]

  const allDone = checklistItems.every((c) => c.done)
  const vendorSessions = (vendorSessionsRes.data ?? []) as Array<{
    id: string
    title: string | null
    date: string | null
    max_attendees: number | null
    available_slots: number | null
    duration_minutes: number | null
    booking_status: string | null
  }>
  const trialDays = vendor.status === 'trialing' ? daysUntil(vendor.trial_ends_at) : null

  const activityBookingMap = new Map<string, BookingActivityRow>()
  for (const row of activityCreatedRes.data ?? []) {
    const r = row as BookingActivityRow & { id: string }
    activityBookingMap.set(r.id, { created_at: r.created_at, status: r.status, refunded_at: r.refunded_at })
  }
  for (const row of activityRefundRes.data ?? []) {
    const r = row as BookingActivityRow & { id: string }
    activityBookingMap.set(r.id, { created_at: r.created_at, status: r.status, refunded_at: r.refunded_at })
  }
  const activitySeries30 = buildActivitySeriesFromBookings([...activityBookingMap.values()], 30)

  const spotsRemaining = (capacityRes.data ?? []).reduce((sum: number, ev: { available_slots?: number | null }) => {
    const n = ev.available_slots
    return sum + (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0)
  }, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">
            Welcome back, {vendor.business_name}
          </h1>
          <p className="text-sm text-[#888] mt-1">Here's what's happening with your workshops.</p>
        </div>
        <PartnerDashboardHeaderActions items={checklistItems} allDone={allDone} trialDays={trialDays} />
      </div>

      {/* Status banners */}
      {vendor.status === 'past_due' && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-red-700">Payment failed.</span>{' '}
            <span className="text-red-600">Please update your payment method to avoid suspension.</span>
          </div>
          <Link
            href="/partners/dashboard/settings"
            className="text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Update card
          </Link>
        </div>
      )}

      {!vendor.stripe_connect_completed && vendor.stripe_checkout_completed && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1 text-sm text-amber-700">
            <span className="font-semibold">Set up your payout account</span> to receive payments from bookings.
          </div>
          <ConnectStripeButton />
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Active workshops',
            value: activeSessions,
            icon: CalendarDays,
            href: '/partners/dashboard/sessions',
          },
          {
            label: 'Bookings this month',
            value: monthlyBookings,
            icon: Users,
            href: '/partners/dashboard/bookings',
          },
          {
            label: 'Revenue this month',
            value: formatCad(monthlyRevenue),
            icon: DollarSign,
            href: '/partners/dashboard/payouts',
          },
        ].map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.label}
              href={card.href}
              className="bg-white border border-[#E8E4DE] rounded-xl p-5 hover:border-[#5D755D] transition-colors group"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-[#888]">{card.label}</p>
                <Icon className="w-4 h-4 text-[#C8BFB0] group-hover:text-[#5D755D] transition-colors" />
              </div>
              <p className="text-2xl font-semibold text-[#1a1a1a]">{card.value}</p>
            </Link>
          )
        })}
      </div>

      <DashboardActivityChart series30={activitySeries30} spotsRemaining={spotsRemaining} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workshops overview */}
        <div className="bg-white border border-[#E8E4DE] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#1a1a1a]">Your workshops</h2>
            <Link
              href="/partners/dashboard/sessions"
              className="text-xs text-[#5D755D] font-medium hover:underline"
            >
              Manage
            </Link>
          </div>
          <p className="text-xs text-[#888] -mt-2 mb-4">
            {vendorSessions.length >= 100
              ? 'Showing your 100 most recent workshops by date (latest first). Open Workshops for the full list.'
              : 'Sorted by workshop date (latest first). Counts reflect the latest data when you load this page.'}
          </p>

          {!vendorSessions.length ? (
            <div className="text-center py-8">
              <CalendarDays className="w-8 h-8 text-[#C8BFB0] mx-auto mb-2" />
              <p className="text-sm text-[#888]">No workshops yet.</p>
              <Link
                href="/partners/dashboard/sessions?new=1"
                className="inline-block mt-3 text-xs font-medium text-[#5D755D] hover:underline"
              >
                Create a workshop →
              </Link>
            </div>
          ) : (
            <ul className="space-y-0 divide-y divide-[#F5F2EE]">
              {vendorSessions.map((session) => (
                <li key={session.id}>
                  <Link
                    href="/partners/dashboard/sessions"
                    className="block py-3.5 first:pt-0 hover:bg-[#FAF9F7] -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] truncate">
                          {session.title ?? 'Untitled workshop'}
                        </p>
                        <p className="text-xs text-[#555] mt-1">
                          {formatSessionDate(session.date)}
                        </p>
                        <p className="text-xs text-[#888] mt-1">
                          {spotsFilledLabel(session.max_attendees, session.available_slots)}
                          <span className="text-[#C8BFB0] mx-1.5">·</span>
                          {formatDurationMinutes(session.duration_minutes)}
                        </p>
                      </div>
                      {session.booking_status && (
                        <span className="text-[10px] uppercase tracking-wide font-medium text-[#888] flex-shrink-0 mt-0.5">
                          {session.booking_status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent bookings */}
        <div className="bg-white border border-[#E8E4DE] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#1a1a1a]">Recent bookings</h2>
            <Link
              href="/partners/dashboard/bookings"
              className="text-xs text-[#5D755D] font-medium hover:underline"
            >
              View all
            </Link>
          </div>

          {!recentBookingsRes.data?.length ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-[#C8BFB0] mx-auto mb-2" />
              <p className="text-sm text-[#888]">No bookings yet.</p>
              <Link
                href="/partners/dashboard/sessions?new=1"
                className="inline-block mt-3 text-xs font-medium text-[#5D755D] hover:underline"
              >
                Create your first workshop →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentBookingsRes.data.map((booking: Record<string, unknown>) => (
                <div key={booking.id as string} className="flex items-center justify-between py-2 border-b border-[#F5F2EE] last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1a1a1a] truncate">
                      {(booking.name as string) || 'Guest'}
                    </p>
                    <p className="text-xs text-[#888] truncate">
                      {(booking.session_title as { title: string } | null)?.title || 'Unknown workshop'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-medium text-[#1a1a1a]">
                      {booking.amount_cad ? formatCad(booking.amount_cad as number) : '—'}
                    </p>
                    <p className="text-xs text-[#888]">
                      {new Date(booking.created_at as string).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
