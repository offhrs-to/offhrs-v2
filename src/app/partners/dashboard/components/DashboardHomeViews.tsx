'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Users } from 'lucide-react'
import { DashboardActivityChart } from './DashboardActivityChart'
import type { ActivityDayPoint } from '@/lib/partner-dashboard-activity'
import { spotsFilledLabel } from '@/lib/workshop-spots-label'
import { getTorontoYmd } from '@/lib/workshop-timezone'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PartnerEmptyState } from './PartnerEmptyState'
import { cn } from '@/lib/utils'

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

function MetricsStrip({
  items,
}: {
  items: Array<{
    label: string
    value: React.ReactNode
    caption?: string
    href?: string
    emphasize?: boolean
  }>
}) {
  return (
    <div className="flex flex-col rounded-xl border border-partner-border bg-white sm:flex-row sm:items-stretch">
      {items.map((item, i) => {
        const body = (
          <>
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            <p
              className={cn(
                'mt-1.5 text-2xl font-semibold tabular-nums tracking-tight',
                item.emphasize ? 'text-primary' : 'text-foreground'
              )}
            >
              {item.value}
            </p>
            {item.caption ? (
              <p className="mt-1 text-[10px] text-muted-foreground">{item.caption}</p>
            ) : null}
          </>
        )
        return (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-stretch">
            {i > 0 ? <Separator className="sm:hidden" /> : null}
            {i > 0 ? (
              <Separator orientation="vertical" className="hidden h-auto self-stretch sm:block" />
            ) : null}
            <div className="min-w-0 flex-1 px-5 py-4">
              {item.href ? (
                <Link href={item.href} className="block transition-colors hover:opacity-80">
                  {body}
                </Link>
              ) : (
                body
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WorkshopList({
  workshops,
  emptyTitle,
  emptyHref = '/partners/dashboard/sessions?new=1',
  emptyCta = 'Create a workshop',
}: {
  workshops: DashboardWorkshopRow[]
  emptyTitle: string
  emptyHref?: string
  emptyCta?: string
}) {
  if (!workshops.length) {
    return (
      <PartnerEmptyState
        compact
        icon={CalendarDays}
        title={emptyTitle}
        action={
          <Button variant="link" className="h-auto p-0 text-xs text-primary" asChild>
            <Link href={emptyHref}>{emptyCta}</Link>
          </Button>
        }
      />
    )
  }

  return (
    <ul className="divide-y divide-partner-border/80">
      {workshops.map((session) => (
        <li key={session.id}>
          <Link
            href="/partners/dashboard/sessions"
            className="-mx-2 block rounded-lg px-2 py-3.5 transition-colors first:pt-0 hover:bg-partner-canvas"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {session.title ?? 'Untitled workshop'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{formatSessionDate(session.date)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {spotsFilledLabel(session.max_attendees, session.available_slots)}
                  <span className="mx-1.5 text-muted-foreground/40">·</span>
                  {formatDurationMinutes(session.duration_minutes)}
                </p>
              </div>
              {session.booking_status ? (
                <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px] uppercase tracking-wide">
                  {session.booking_status.replace(/_/g, ' ')}
                </Badge>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
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

  const selectView = (next: string) => {
    const v = next === 'monthly' ? 'monthly' : 'today'
    setView(v)
    try {
      window.localStorage.setItem(STORAGE_KEY, v)
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

  return (
    <Tabs value={view} onValueChange={selectView} className="gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Dashboard view
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {view === 'today'
              ? 'Focus on what needs attention today.'
              : 'Month-to-date performance and your workshop inventory.'}
          </p>
        </div>
        <TabsList className="self-start border border-partner-border bg-partner-canvas">
          <TabsTrigger value="today" className="text-xs">
            Today&apos;s Snapshot
          </TabsTrigger>
          <TabsTrigger value="monthly" className="text-xs">
            Monthly Overview
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="monthly" className="space-y-6">
        <MetricsStrip
          items={[
            {
              label: 'Active workshops',
              value: activeSessions,
              href: '/partners/dashboard/sessions',
            },
            {
              label: 'Bookings this month',
              value: monthlyBookings,
              href: '/partners/dashboard/bookings',
            },
            {
              label: 'Payouts this month',
              value: formatCad(monthlyRevenueCad),
              href: '/partners/dashboard/payouts',
            },
          ]}
        />

        <DashboardActivityChart
          series30={activitySeries30}
          spotsRemaining={spotsRemaining}
          forcedRange={30}
          hideRangeToggle
          showSpotsRemaining={false}
        />

        <Card className="gap-0 py-0 shadow-none border-partner-border">
          <CardHeader className="flex-row items-center justify-between space-y-0 px-5 py-4">
            <div>
              <CardTitle className="text-sm">Your workshops</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {workshops.length >= 100
                  ? 'Showing your 100 most recent workshops by date (latest first). Open Workshops for the full list.'
                  : 'Sorted by workshop date (latest first). Counts reflect the latest data when you load this page.'}
              </CardDescription>
            </div>
            <Button variant="link" className="h-auto shrink-0 p-0 text-xs text-primary" asChild>
              <Link href="/partners/dashboard/sessions">Manage</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <WorkshopList workshops={workshops} emptyTitle="No workshops yet." />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="today" className="space-y-6">
        <MetricsStrip
          items={[
            {
              label: 'Sessions today',
              value: todaysWorkshops.length,
            },
            {
              label: 'Spots left to fill',
              value: spotsRemaining,
              emphasize: true,
            },
            {
              label: 'Recent bookings',
              value: recentBookings.length,
              caption: 'Latest on this page',
              href: '/partners/dashboard/bookings',
            },
          ]}
        />

        <DashboardActivityChart
          series30={activitySeries30}
          spotsRemaining={spotsRemaining}
          forcedRange={7}
          hideRangeToggle
          showSpotsRemaining={false}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="gap-0 border-partner-border py-0 shadow-none">
            <CardHeader className="flex-row items-center justify-between space-y-0 px-5 py-4">
              <div>
                <CardTitle className="text-sm">Today&apos;s workshops</CardTitle>
                <CardDescription className="mt-1 text-xs">
                  Sessions scheduled for {todayYmd} (America/Toronto).
                </CardDescription>
              </div>
              <Button variant="link" className="h-auto shrink-0 p-0 text-xs text-primary" asChild>
                <Link href="/partners/dashboard/calendar">Calendar</Link>
              </Button>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <WorkshopList
                workshops={todaysWorkshops}
                emptyTitle="No workshops scheduled for today."
              />
            </CardContent>
          </Card>

          <Card className="gap-0 border-partner-border py-0 shadow-none">
            <CardHeader className="flex-row items-center justify-between space-y-0 px-5 py-4">
              <CardTitle className="text-sm">Recent bookings</CardTitle>
              <Button variant="link" className="h-auto shrink-0 p-0 text-xs text-primary" asChild>
                <Link href="/partners/dashboard/bookings">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {!recentBookings.length ? (
                <PartnerEmptyState
                  compact
                  icon={Users}
                  title="No bookings yet."
                  action={
                    <Button variant="link" className="h-auto p-0 text-xs text-primary" asChild>
                      <Link href="/partners/dashboard/sessions?new=1">Create your first workshop</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-0 divide-y divide-partner-border/80">
                  {recentBookings.map((booking) => {
                    const displayStatus = bookingDisplayStatus(booking)
                    const isRefunded = displayStatus === 'refunded'
                    return (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {booking.name || 'Guest'}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {booking.session_title?.title || 'Unknown workshop'}
                          </p>
                        </div>
                        <div className="ml-3 shrink-0 text-right">
                          <p
                            className={cn(
                              'text-sm font-medium',
                              isRefunded ? 'text-muted-foreground line-through' : 'text-foreground'
                            )}
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
                          <p className="text-xs text-muted-foreground">
                            {isRefunded && booking.refunded_at
                              ? `Refunded ${new Date(booking.refunded_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`
                              : new Date(booking.created_at).toLocaleDateString('en-CA', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                          </p>
                          {isRefunded ? (
                            <Badge
                              variant="secondary"
                              className="mt-0.5 text-[10px] uppercase tracking-wide"
                            >
                              Refunded
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  )
}
