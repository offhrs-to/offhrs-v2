'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Users, DollarSign } from 'lucide-react'
import { DashboardActivityChart } from './DashboardActivityChart'
import type { ActivityDayPoint } from '@/lib/partner-dashboard-activity'
import { spotsFilledLabel } from '@/lib/workshop-spots-label'
import { getTorontoYmd } from '@/lib/workshop-timezone'

export type DashboardWorkshopRow = {
  id: string
  title: string | null
  date: string | null
  max_attendees: number | null
  available_slots: number | null
  duration_minutes: number | null
  booking_status: string | null
}

export type DashboardBookingRow = {
  id: string
  name: string | null
  session_title: { title: string } | null
  created_at: string
  amount_cad: number | null
  net_vendor_cad: number | null
  status: string | null
  refunded_at: string | null
}

type HomeView = 'today' | 'monthly'

const STORAGE_KEY = 'offhrs.partnerDashboardHomeView'

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
    timeZone: 'America/Toronto',
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

function bookingDisplayStatus(booking: { status?: string | null; refunded_at?: string | null }): string {
  if (booking.refunded_at || (booking.status ?? '').toLowerCase() === 'refunded') return 'refunded'
  return (booking.status ?? 'confirmed').toLowerCase()
}

function sessionTorontoYmd(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return getTorontoYmd(d)
}

function readStoredView(): HomeView {
  if (typeof window === 'undefined') return 'today'
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'monthly' || v === 'today') return v
  } catch {
    /* ignore */
  }
  return 'today'
}

export function DashboardHomeViews({
  activeSessions,
  monthlyBookings,
  monthlyRevenueCad,
  spotsRemaining,
  activitySeries30,
  workshops,
  recentBookings,
}: {
  activeSessions: number
  monthlyBookings: number
  monthlyRevenueCad: number
  spotsRemaining: number
  activitySeries30: ActivityDayPoint[]
  workshops: DashboardWorkshopRow[]
  recentBookings: DashboardBookingRow[]
}) {
  const [view, setView] = useState<HomeView>('today')

  useEffect(() => {
    setView(readStoredView())
  }, [])

  const selectView = (next: HomeView) => {
    setView(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }

  const todayYmd = getTorontoYmd()
  const todaysWorkshops = useMemo(
    () =>
      workshops
        .filter((w) => sessionTorontoYmd(w.date) === todayYmd)
        .sort((a, b) => {
          const ta = a.date ? new Date(a.date).getTime() : 0
          const tb = b.date ? new Date(b.date).getTime() : 0
          return ta - tb
        }),
    [workshops, todayYmd]
  )

  const kpiCards = [
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
      label: 'Payouts this month',
      value: formatCad(monthlyRevenueCad),
      icon: DollarSign,
      href: '/partners/dashboard/payouts',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#888]">Dashboard view</p>
          <p className="text-sm text-[#555] mt-0.5">
            {view === 'today'
              ? 'Focus on what needs attention today.'
              : 'Month-to-date performance and your workshop inventory.'}
          </p>
        </div>
        <div
          className="flex rounded-lg border border-[#E8E4DE] p-0.5 bg-[#FAFAF8] self-start"
          role="tablist"
          aria-label="Dashboard view"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'today'}
            onClick={() => selectView('today')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === 'today' ? 'bg-white text-[#1a1a1a] shadow-sm' : 'text-[#888] hover:text-[#555]'
            }`}
          >
            Today&apos;s Snapshot
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'monthly'}
            onClick={() => selectView('monthly')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === 'monthly' ? 'bg-white text-[#1a1a1a] shadow-sm' : 'text-[#888] hover:text-[#555]'
            }`}
          >
            Monthly Overview
          </button>
        </div>
      </div>

      {view === 'monthly' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {kpiCards.map((card) => {
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

          <DashboardActivityChart
            series30={activitySeries30}
            spotsRemaining={spotsRemaining}
            forcedRange={30}
            hideRangeToggle
            showSpotsRemaining={false}
          />

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
              {workshops.length >= 100
                ? 'Showing your 100 most recent workshops by date (latest first). Open Workshops for the full list.'
                : 'Sorted by workshop date (latest first). Counts reflect the latest data when you load this page.'}
            </p>

            {!workshops.length ? (
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
                {workshops.map((session) => (
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
                          <p className="text-xs text-[#555] mt-1">{formatSessionDate(session.date)}</p>
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
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#E8E4DE] rounded-xl p-5">
              <p className="text-xs font-medium text-[#888] mb-3">Sessions today</p>
              <p className="text-2xl font-semibold text-[#1a1a1a] tabular-nums">{todaysWorkshops.length}</p>
            </div>
            <div className="bg-white border border-[#E8E4DE] rounded-xl p-5">
              <p className="text-xs font-medium text-[#888] mb-3">Spots left to fill</p>
              <p className="text-2xl font-semibold text-[#5D755D] tabular-nums">{spotsRemaining}</p>
            </div>
            <Link
              href="/partners/dashboard/bookings"
              className="bg-white border border-[#E8E4DE] rounded-xl p-5 hover:border-[#5D755D] transition-colors group"
            >
              <p className="text-xs font-medium text-[#888] mb-3 group-hover:text-[#5D755D]">Recent bookings</p>
              <p className="text-2xl font-semibold text-[#1a1a1a] tabular-nums">{recentBookings.length}</p>
              <p className="text-[10px] text-[#888] mt-1">Latest on this page</p>
            </Link>
          </div>

          <DashboardActivityChart
            series30={activitySeries30}
            spotsRemaining={spotsRemaining}
            forcedRange={7}
            hideRangeToggle
            showSpotsRemaining={false}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-[#E8E4DE] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-[#1a1a1a]">Today&apos;s workshops</h2>
                <Link
                  href="/partners/dashboard/calendar"
                  className="text-xs text-[#5D755D] font-medium hover:underline"
                >
                  Calendar
                </Link>
              </div>
              <p className="text-xs text-[#888] -mt-2 mb-4">
                Sessions scheduled for {todayYmd} (America/Toronto).
              </p>

              {!todaysWorkshops.length ? (
                <div className="text-center py-8">
                  <CalendarDays className="w-8 h-8 text-[#C8BFB0] mx-auto mb-2" />
                  <p className="text-sm text-[#888]">No workshops scheduled for today.</p>
                  <Link
                    href="/partners/dashboard/sessions?new=1"
                    className="inline-block mt-3 text-xs font-medium text-[#5D755D] hover:underline"
                  >
                    Create a workshop →
                  </Link>
                </div>
              ) : (
                <ul className="space-y-0 divide-y divide-[#F5F2EE]">
                  {todaysWorkshops.map((session) => (
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
                            <p className="text-xs text-[#555] mt-1">{formatSessionDate(session.date)}</p>
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

              {!recentBookings.length ? (
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
                  {recentBookings.map((booking) => {
                    const displayStatus = bookingDisplayStatus(booking)
                    const isRefunded = displayStatus === 'refunded'
                    return (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between py-2 border-b border-[#F5F2EE] last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1a1a1a] truncate">
                            {booking.name || 'Guest'}
                          </p>
                          <p className="text-xs text-[#888] truncate">
                            {booking.session_title?.title || 'Unknown workshop'}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p
                            className={`text-sm font-medium ${isRefunded ? 'text-[#888] line-through' : 'text-[#1a1a1a]'}`}
                            title={
                              booking.amount_cad != null
                                ? `Customer paid ${formatCad(booking.amount_cad)} (incl. tax). Showing payout after Stripe fee.`
                                : undefined
                            }
                          >
                            {booking.net_vendor_cad != null
                              ? formatCad(booking.net_vendor_cad)
                              : booking.amount_cad != null
                                ? formatCad(booking.amount_cad)
                                : '—'}
                          </p>
                          <p className="text-xs text-[#888]">
                            {isRefunded && booking.refunded_at
                              ? `Refunded ${new Date(booking.refunded_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`
                              : new Date(booking.created_at).toLocaleDateString('en-CA', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                          </p>
                          {isRefunded && (
                            <span className="inline-block mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#888] bg-[#F0EDE8] px-1.5 py-0.5 rounded">
                              Refunded
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
