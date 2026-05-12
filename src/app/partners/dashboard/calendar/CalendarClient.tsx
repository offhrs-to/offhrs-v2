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
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'

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
}

type CalendarStatus = {
  configured: { google: boolean; microsoft: boolean }
  google: { connected: boolean; email: string | null }
  microsoft: { connected: boolean; email: string | null }
}

function sessionsOnDay(sessions: Session[], day: Date): Session[] {
  return sessions.filter((s) => {
    if (!s.date) return false
    const d = new Date(s.date)
    return !Number.isNaN(d.getTime()) && isSameDay(d, day)
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
    const err = searchParams.get('cal_error')
    const ok = searchParams.get('cal_connected')
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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-1">Calendar</h1>
          <p className="text-sm text-[#888] max-w-xl">
            Month view of your workshops. Connect Google Calendar or Outlook to create and update matching events when
            you publish or change a workshop (published / fully booked only, with a scheduled date).
          </p>
        </div>
        <Link
          href="/partners/dashboard/sessions?new=1"
          className="inline-flex items-center justify-center rounded-xl border border-[#E8E4DE] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#FAFAF8] transition-colors self-start"
        >
          New workshop
        </Link>
      </div>

      {banner && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{banner}</div>
      )}

      <div className="bg-white border border-[#E8E4DE] rounded-xl p-4 sm:p-5">
        <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wide mb-3">External calendars</h2>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          {status?.configured.google && (
            <div className="flex items-center gap-2 flex-wrap">
              {status.google.connected ? (
                <>
                  <span className="text-sm text-[#1a1a1a]">
                    Google: <span className="text-[#5D755D] font-medium">{status.google.email ?? 'connected'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => disconnect('google')}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <a
                  href="/api/partners/calendar/oauth/google/start"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#E8E4DE] px-3 py-2 text-sm font-medium text-[#1a1a1a] hover:border-[#5D755D] transition-colors"
                >
                  Connect Google Calendar
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </a>
              )}
            </div>
          )}
          {status?.configured.microsoft && (
            <div className="flex items-center gap-2 flex-wrap">
              {status.microsoft.connected ? (
                <>
                  <span className="text-sm text-[#1a1a1a]">
                    Outlook: <span className="text-[#5D755D] font-medium">{status.microsoft.email ?? 'connected'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => disconnect('microsoft')}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <a
                  href="/api/partners/calendar/oauth/microsoft/start"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#E8E4DE] px-3 py-2 text-sm font-medium text-[#1a1a1a] hover:border-[#5D755D] transition-colors"
                >
                  Connect Outlook
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </a>
              )}
            </div>
          )}
          {status && !status.configured.google && !status.configured.microsoft && (
            <p className="text-xs text-[#888]">
              OAuth is not configured on this deployment. Set Google and/or Microsoft env vars (see .env.example).
            </p>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#E8E4DE] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0EDE8]">
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="p-2 rounded-lg hover:bg-[#F5F2EE] text-[#555]"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-sm font-semibold text-[#1a1a1a]">{monthLabel}</h2>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="p-2 rounded-lg hover:bg-[#F5F2EE] text-[#555]"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-[#E8E4DE] text-center text-[10px] sm:text-xs font-medium text-[#888] uppercase tracking-wide">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="bg-[#FAFAF8] py-2">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-[#E8E4DE]">
          {gridDays.map((day) => {
            const inMonth = isSameMonth(day, month)
            const list = sessionsOnDay(sessions, day)
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[88px] sm:min-h-[100px] bg-white p-1 sm:p-1.5 text-left ${!inMonth ? 'opacity-40' : ''}`}
              >
                <div className="text-xs font-medium text-[#1a1a1a] mb-1">{format(day, 'd')}</div>
                <div className="space-y-0.5 overflow-hidden">
                  {list.slice(0, 3).map((s) => (
                    <Link
                      key={s.id}
                      href={`/partners/dashboard/sessions?edit=${s.id}`}
                      className="block truncate rounded px-0.5 py-0.5 text-[10px] sm:text-[11px] font-medium leading-tight bg-[#EDF2ED] text-[#3d523d] hover:bg-[#dfe8df]"
                      title={s.title}
                    >
                      {s.title}
                    </Link>
                  ))}
                  {list.length > 3 && (
                    <span className="text-[9px] text-[#aaa]">+{list.length - 3} more</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {loading && <div className="px-4 py-6 text-center text-sm text-[#888]">Loading…</div>}
        {!loading && sessions.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-[#888]">
            No workshops with dates in this month.{' '}
            <Link href="/partners/dashboard/sessions" className="text-[#5D755D] font-medium hover:underline">
              Add a workshop
            </Link>
          </div>
        )}
      </div>

      <div className="text-xs text-[#888] space-y-1">
        <p>
          <strong className="text-[#555]">Sync rules:</strong> We push to Google/Outlook only when status is
          Published or Fully booked and the workshop has a date/time. Drafts and archived workshops remove the external
          event.
        </p>
      </div>
    </div>
  )
}
