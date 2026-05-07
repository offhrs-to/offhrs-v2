import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { CheckCircle2, Circle, AlertTriangle, CalendarDays, Users, DollarSign, Clock } from 'lucide-react'
import Link from 'next/link'
import { ConnectStripeButton } from './components/ConnectStripeButton'

interface VendorProfile {
  id: string
  business_name: string
  status: string
  email_verified: boolean
  stripe_checkout_completed: boolean
  stripe_connect_completed: boolean
  cal_connected: boolean
  first_session_created: boolean
  trial_ends_at: string | null
  subscription_current_period_end: string | null
}

interface BookingSummary {
  count: number
  revenue: number
}

function daysUntil(date: string | null): number | null {
  if (!date) return null
  const diff = new Date(date).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function formatCad(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount)
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

  const [sessionsRes, bookingsRes, recentBookingsRes] = await Promise.all([
    admin
      .from('events')
      .select('id', { count: 'exact' })
      .eq('vendor_profile_id', vendor.id)
      .in('status', ['published', 'fully_booked']),
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
  ])

  const activeSessions = sessionsRes.count ?? 0
  const monthlyBookings = bookingsRes.data?.length ?? 0
  const monthlyRevenue = bookingsRes.data?.reduce((sum: number, b: { amount_cad?: number | null }) => sum + (b.amount_cad ?? 0), 0) ?? 0

  const checklist = [
    { key: 'email_verified', label: 'Verify your email', done: vendor.email_verified },
    { key: 'stripe_checkout_completed', label: 'Start free trial', done: vendor.stripe_checkout_completed },
    {
      key: 'stripe_connect_completed',
      label: 'Set up payout account (Stripe)',
      done: vendor.stripe_connect_completed,
      cta: !vendor.stripe_connect_completed,
    },
    {
      key: 'cal_connected',
      label: 'Connect Google or Outlook calendar',
      done: vendor.cal_connected,
      href: '/partners/dashboard/calendar',
    },
    {
      key: 'first_session_created',
      label: 'Create your first workshop session',
      done: vendor.first_session_created,
      href: '/partners/dashboard/sessions?new=1',
    },
  ]

  const allDone = checklist.every((c) => c.done)
  const trialDays = vendor.status === 'trialing' ? daysUntil(vendor.trial_ends_at) : null

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">
            Welcome back, {vendor.business_name}
          </h1>
          <p className="text-sm text-[#888] mt-1">Here's what's happening with your workshops.</p>
        </div>
        {trialDays !== null && (
          <div className={`text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
            trialDays <= 3
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-[#EDF2ED] text-[#5D755D]'
          }`}>
            <Clock className="w-3.5 h-3.5" />
            {trialDays === 0 ? 'Trial ends today' : `${trialDays} days left in trial`}
          </div>
        )}
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

      {!vendor.cal_connected && vendor.stripe_checkout_completed && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <CalendarDays className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div className="flex-1 text-sm text-blue-700">
            <span className="font-semibold">Connect your calendar</span> so bookings sync automatically.
          </div>
          <Link
            href="/partners/dashboard/calendar"
            className="text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Connect
          </Link>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Active sessions',
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Onboarding checklist */}
        {!allDone && (
          <div className="bg-white border border-[#E8E4DE] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#1a1a1a] mb-4">Getting started</h2>
            <div className="space-y-3">
              {checklist.map((item) => (
                <div key={item.key} className="flex items-start gap-3">
                  {item.done ? (
                    <CheckCircle2 className="w-5 h-5 text-[#5D755D] flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-5 h-5 text-[#C8BFB0] flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${item.done ? 'text-[#888] line-through' : 'text-[#1a1a1a]'}`}>
                      {item.label}
                    </p>
                  </div>
                  {!item.done && item.cta && (
                    <ConnectStripeButton compact />
                  )}
                  {!item.done && item.href && (
                    <Link
                      href={item.href}
                      className="text-xs font-medium text-[#5D755D] hover:underline flex-shrink-0"
                    >
                      Go →
                    </Link>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 h-1.5 bg-[#F0EDE8] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#5D755D] rounded-full transition-all"
                style={{ width: `${(checklist.filter((c) => c.done).length / checklist.length) * 100}%` }}
              />
            </div>
          </div>
        )}

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
                Create your first session →
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
                      {(booking.session_title as { title: string } | null)?.title || 'Unknown session'}
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
