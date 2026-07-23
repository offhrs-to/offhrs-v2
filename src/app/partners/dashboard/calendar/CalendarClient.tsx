'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Session = {
  id: string
  title: string
  date: string | null
  duration_minutes: number | null
  booking_status: string | null
  available_slots: number | null
  max_attendees: number | null
  location: string | null
  price_cad: number | null
  status?: string
  calendarRowKey?: string
}

type CalendarStatus = {
  configured: { google: boolean; microsoft: boolean }
  google: { connected: boolean; email: string | null }
  microsoft: { connected: boolean; email: string | null }
}

function workshopDateKey(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : null
}

function sessionsOnDay(sessions: Session[], day: Date): Session[] {
  const dayKey = format(day, 'yyyy-MM-dd')
  return sessions.filter((s) => {
    if (!s.date) return false
    const d = new Date(s.date)
    return workshopDateKey(d) === dayKey
  })
}

export function CalendarClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<CalendarStatus | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const monthLabel = format(month, 'MMMM yyyy')

  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [month])

  const loadSessions = useCallback(async () => {
    setLoading(true)
    const from = startOfMonth(month).toISOString()
    const to = endOfMonth(month).toISOString()
    try {
      const res = await fetch(
        `/api/partners/sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&exclude_archived=1`
      )
      const data = await res.json()
      setSessions(data.sessions ?? [])
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [month])

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/partners/calendar/status')
      if (res.ok) setStatus(await res.json())
    } catch {
      setStatus(null)
    }
  }, [])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    const err = searchParams.get('calendar_error')
    const ok = searchParams.get('calendar_connected')
    if (!err && !ok) return
    if (err) setBanner(`Calendar: ${decodeURIComponent(err)}`)
    else if (ok) {
      setBanner(
        `Connected ${ok === 'google' ? 'Google Calendar' : 'Outlook'} — syncing your published workshops.`
      )
    }
    void loadStatus()
    void loadSessions()
    router.replace('/partners/dashboard/calendar', { scroll: false })
  }, [searchParams, router, loadStatus, loadSessions])

  async function disconnect(provider: 'google' | 'microsoft') {
    if (
      !confirm(
        `Disconnect ${provider === 'google' ? 'Google Calendar' : 'Outlook'}? Events we added will be removed from your calendar.`
      )
    )
      return
    await fetch('/api/partners/calendar/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    })
    await loadStatus()
    await loadSessions()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Calendar</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Month view of your workshops. Connect Google Calendar or Outlook to create and update matching events when
            you publish or change a workshop (published / fully booked only, with a scheduled date).
          </p>
        </div>
        <Button variant="outline" className="self-start border-partner-border" asChild>
          <Link href="/partners/dashboard/sessions?new=1">New workshop</Link>
        </Button>
      </div>

      {banner && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertDescription>{banner}</AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 border-partner-border py-0 shadow-none">
        <CardHeader className="px-4 py-4 sm:px-5">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            External calendars
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col flex-wrap gap-3 px-4 pb-4 sm:flex-row sm:px-5 sm:pb-5">
          {status?.configured.google && (
            <div className="flex flex-wrap items-center gap-2">
              {status.google.connected ? (
                <>
                  <span className="text-sm text-foreground">
                    Google:{' '}
                    <span className="font-medium text-primary">{status.google.email ?? 'connected'}</span>
                  </span>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => disconnect('google')}
                    className="h-auto p-0 text-xs text-red-600"
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" className="border-partner-border" asChild>
                  <a href="/api/partners/calendar/oauth/google/start">
                    Connect Google Calendar
                    <ExternalLink className="size-3.5 opacity-60" />
                  </a>
                </Button>
              )}
            </div>
          )}
          {status?.configured.microsoft && (
            <div className="flex flex-wrap items-center gap-2">
              {status.microsoft.connected ? (
                <>
                  <span className="text-sm text-foreground">
                    Outlook:{' '}
                    <span className="font-medium text-primary">{status.microsoft.email ?? 'connected'}</span>
                  </span>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => disconnect('microsoft')}
                    className="h-auto p-0 text-xs text-red-600"
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" className="border-partner-border" asChild>
                  <a href="/api/partners/calendar/oauth/microsoft/start">
                    Connect Outlook
                    <ExternalLink className="size-3.5 opacity-60" />
                  </a>
                </Button>
              )}
            </div>
          )}
          {status && !status.configured.google && !status.configured.microsoft && (
            <p className="text-xs text-muted-foreground">
              OAuth is not configured on this deployment. Set Google and/or Microsoft env vars (see .env.example).
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden border-partner-border py-0 shadow-none">
        <div className="flex items-center justify-between border-b border-partner-border px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            aria-label="Previous month"
            className="text-muted-foreground"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <h2 className="text-sm font-semibold text-foreground">{monthLabel}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
            className="text-muted-foreground"
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-partner-border text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="bg-partner-canvas py-2">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-partner-border">
          {gridDays.map((day) => {
            const inMonth = isSameMonth(day, month)
            const list = sessionsOnDay(sessions, day)
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[88px] bg-white p-1 text-left sm:min-h-[100px] sm:p-1.5 ${!inMonth ? 'opacity-40' : ''}`}
              >
                <div className="mb-1 text-xs font-medium text-foreground">{format(day, 'd')}</div>
                <div className="space-y-0.5 overflow-hidden">
                  {list.slice(0, 3).map((s) => (
                    <Link
                      key={'calendarRowKey' in s && s.calendarRowKey ? s.calendarRowKey : s.id}
                      href={`/partners/dashboard/sessions?edit=${s.id}`}
                      className="block truncate rounded px-1.5 py-1 text-[11px] font-medium leading-tight bg-partner-tint text-primary hover:opacity-80 sm:text-xs"
                      title={s.title}
                    >
                      {s.title}
                    </Link>
                  ))}
                  {list.length > 3 && (
                    <span className="px-1 text-[10px] text-muted-foreground/70">+{list.length - 3} more</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {loading && <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {!loading && sessions.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No workshops with dates in this month.{' '}
            <Link href="/partners/dashboard/sessions" className="font-medium text-primary hover:underline">
              Add a workshop
            </Link>
          </div>
        )}
      </Card>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">Sync rules:</strong> We push to Google/Outlook only when status is
          Published or Fully booked and the workshop has a date/time. Drafts and archived workshops remove the
          external event. Multi-week workshops (one listing with several dates) create one calendar event per session
          date; we update them when you change the workshop.
        </p>
      </div>
    </div>
  )
}
