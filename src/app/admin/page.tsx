'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink, Edit, Trash2, Loader2, Image as ImageIcon, LogOut } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import Navbar from '@/components/navbar'
import { deleteEvent } from '@/app/actions/events'

interface Event {
  id: string
  title: string
  date: string | null
  image_url: string | null
  created_at: string
  external_link: string | null
  is_multiple_dates: boolean | null
}

type EventFilter = 'all' | 'upcoming' | 'expired'

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [sessionChecking, setSessionChecking] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const adminAuthRef = useRef<string | null>(null)

  const [events, setEvents] = useState<Event[]>([])
  const [redirectCounts, setRedirectCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [eventFilter, setEventFilter] = useState<EventFilter>('all')
  const [backfillLoading, setBackfillLoading] = useState(false)
  const [backfillResult, setBackfillResult] = useState<string | null>(null)
  const [checkLinksLoading, setCheckLinksLoading] = useState(false)
  const [checkLinksResult, setCheckLinksResult] = useState<{
    summary: { total: number; ok: number; broken: number }
    results: { eventId: string; title: string; url: string; ok: boolean; status?: number; error?: string }[]
    error?: string
  } | null>(null)
  const [dailyVisits, setDailyVisits] = useState<{ today: number; byDay: { date: string; count: number }[] } | null>(null)

  const filteredEvents = events.filter((event) => {
    const isExpired = event.date != null && new Date(event.date) < new Date()
    if (eventFilter === 'upcoming') return !isExpired
    if (eventFilter === 'expired') return isExpired
    return true
  })

  const getAdminHeaders = (): HeadersInit => {
    const h: HeadersInit = { 'Content-Type': 'application/json' }
    if (adminAuthRef.current) {
      (h as Record<string, string>)['Authorization'] = `Basic ${adminAuthRef.current}`
    }
    return h
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include',
    })
    if (res.ok) {
      adminAuthRef.current = typeof btoa !== 'undefined' ? btoa(`${username}:${password}`) : Buffer.from(`${username}:${password}`).toString('base64')
      setIsAuthenticated(true)
      fetchEvents()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Invalid credentials')
    }
  }

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const [eventsRes, countsRes, visitsRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, title, date, image_url, created_at, external_link, is_multiple_dates')
          .order('created_at', { ascending: false }),
        fetch('/api/admin/event-redirect-counts', { credentials: 'include', headers: getAdminHeaders() }).then((r) => (r.ok ? r.json() : { counts: {} })).catch(() => ({ counts: {} })),
        fetch('/api/admin/daily-visits', { credentials: 'include', headers: getAdminHeaders() }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ])
      if (eventsRes.error) throw eventsRes.error
      setEvents(eventsRes.data || [])
      setRedirectCounts(countsRes.counts || {})
      setDailyVisits(visitsRes)
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) fetchEvents()
  }, [isAuthenticated])

  useEffect(() => {
    fetch('/api/admin/session', { credentials: 'include' })
      .then((res) => {
        if (res.ok) setIsAuthenticated(true)
      })
      .finally(() => setSessionChecking(false))
  }, [])

  const handleBackfillCoordinates = async () => {
    setBackfillLoading(true)
    setBackfillResult(null)
    try {
      const res = await fetch('/api/admin/backfill-event-coordinates', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminHeaders(),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBackfillResult(data.error || `Error ${res.status}`)
        return
      }
      setBackfillResult(data.message ?? `Updated ${data.updated ?? 0} event(s).`)
      if (data.updated > 0) await fetchEvents()
    } catch (e: unknown) {
      setBackfillResult(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBackfillLoading(false)
    }
  }

  const handleCheckLinks = async () => {
    setCheckLinksLoading(true)
    setCheckLinksResult(null)
    try {
      const res = await fetch('/api/admin/check-booking-links', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminHeaders(),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCheckLinksResult({
          summary: { total: 0, ok: 0, broken: 0 },
          results: [],
          error: data.error || `Error ${res.status}`,
        })
        return
      }
      setCheckLinksResult({
        summary: data.summary ?? { total: 0, ok: 0, broken: 0 },
        results: data.results ?? [],
      })
    } catch (e: unknown) {
      setCheckLinksResult({
        summary: { total: 0, ok: 0, broken: 0 },
        results: [],
        error: e instanceof Error ? e.message : 'Request failed',
      })
    } finally {
      setCheckLinksLoading(false)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${title}"?`)
    if (!confirmed) return
    setDeletingId(id)
    try {
      await deleteEvent(id)
      await fetchEvents()
    } catch (error: unknown) {
      alert(`Failed to delete event: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Date TBD'
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-US', {
        timeZone: 'America/Toronto',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return dateString
    }
  }

  if (sessionChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-md w-96 space-y-4">
          <h2 className="text-xl font-bold text-center">Admin Login</h2>
          <input
            type="text"
            placeholder="Username"
            className="w-full p-2 border rounded"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-2 border rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="w-full bg-black text-white py-2 rounded font-medium">
            Enter
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Admin Dashboard</h1>
            <p className="text-slate-600">Manage your workshop events</p>
            {dailyVisits != null && (
              <p className="text-sm text-slate-500 mt-2">
                Today&apos;s visitors: <span className="font-semibold text-slate-700">{dailyVisits.today}</span>
                {dailyVisits.byDay.length > 1 && (
                  <span className="ml-3">
                    (last 7 days: {dailyVisits.byDay.slice(-7).map((d) => d.count).join(', ')})
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={async () => {
              adminAuthRef.current = null
              await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
              setIsAuthenticated(false)
            }}
            className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>

        {!loading && events.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <label htmlFor="event-filter" className="text-sm font-medium text-slate-700">
              Filter:
            </label>
            <select
              id="event-filter"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value as EventFilter)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss"
            >
              <option value="all">All events</option>
              <option value="upcoming">Upcoming events</option>
              <option value="expired">Expired events</option>
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBackfillCoordinates}
              disabled={backfillLoading}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              {backfillLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Backfilling…
                </>
              ) : (
                'Backfill event coordinates'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCheckLinks}
              disabled={checkLinksLoading}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              {checkLinksLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Checking…
                </>
              ) : (
                'Check links'
              )}
            </Button>
            {backfillResult && (
              <span className="text-sm text-slate-600">{backfillResult}</span>
            )}
            {checkLinksResult && (
              <div className="flex flex-col gap-1 text-sm text-slate-600">
                {checkLinksResult.error ? (
                  <span className="text-red-600">{checkLinksResult.error}</span>
                ) : (
                  <>
                    <span>
                      {checkLinksResult.summary.total === 0
                        ? 'No upcoming events with booking links.'
                        : `${checkLinksResult.summary.ok} of ${checkLinksResult.summary.total} link(s) OK.`}
                      {checkLinksResult.summary.broken > 0 &&
                        ` ${checkLinksResult.summary.broken} broken.`}
                    </span>
                    {checkLinksResult.summary.broken > 0 && (
                      <ul className="list-disc list-inside text-red-600">
                        {checkLinksResult.results
                          .filter((r) => !r.ok)
                          .map((r) => (
                            <li key={r.eventId}>
                              <span className="font-medium">{r.title}</span>
                              {r.status != null && ` — ${r.status}`}
                              {r.error && ` — ${r.error}`}
                            </li>
                          ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-slate-600 mb-4">No events found.</p>
                <Link href="/admin/add">
                  <Button className="bg-moss hover:bg-moss-dark text-white">
                    Add Your First Event
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : filteredEvents.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-slate-600 mb-4">
                  {eventFilter === 'upcoming' ? 'No upcoming events.' : 'No expired events.'}
                </p>
                <button
                  type="button"
                  onClick={() => setEventFilter('all')}
                  className="text-sm font-medium text-moss hover:text-moss-dark"
                >
                  Show all events
                </button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {eventFilter === 'all' ? 'All' : eventFilter === 'upcoming' ? 'Upcoming' : 'Expired'} Events ({filteredEvents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Image</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Title</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Redirects</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((event) => {
                      const redirects = redirectCounts[String(event.id)] ?? 0
                      return (
                        <tr key={event.id} className="border-b border-gray-100 hover:bg-slate-50/50">
                          <td className="py-4 px-4">
                            <div className="w-16 h-16 rounded-md overflow-hidden bg-slate-100 flex items-center justify-center">
                              {event.image_url ? (
                                <Image
                                  src={event.image_url}
                                  alt={event.title}
                                  width={64}
                                  height={64}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="h-6 w-6 text-slate-400" />
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="max-w-xs">
                              <p className="font-medium text-slate-900 truncate">{event.title}</p>
                              {event.external_link && (
                                <a
                                  href={event.external_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-moss hover:text-moss-dark inline-flex items-center gap-1 mt-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  View Link
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm text-slate-600">
                              {event.is_multiple_dates ? (
                                <span className="inline-flex items-center px-2 py-1 rounded bg-moss/10 text-moss text-xs font-medium">
                                  Multiple Dates
                                </span>
                              ) : (
                                formatDate(event.date)
                              )}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            {event.date && new Date(event.date) < new Date() ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                Expired
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Published
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-sm text-slate-600">
                            {redirects} user{redirects !== 1 ? 's' : ''} redirected
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-end gap-2">
                              <Link href={`/admin/edit/${event.id}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2 border-moss text-moss hover:bg-moss/10"
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(event.id, event.title)}
                                disabled={deletingId === event.id}
                                className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
                              >
                                {deletingId === event.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </>
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-8">
          <Link href="/admin/add">
            <Button className="bg-moss hover:bg-moss-dark text-white">
              Add New Event
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
