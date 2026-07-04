'use client'

import { Suspense } from 'react'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { SessionForm } from './SessionForm'
import { OccurrenceEditModal, type OccurrenceEditTarget } from './OccurrenceEditModal'
import { formatSeriesDateRangeLabel, parseSeriesOccurrences, type EventSeriesFields } from '@/lib/workshop-series'
import { spotsFilledLabel } from '@/lib/workshop-spots-label'

interface Session {
  id: string
  title: string
  category: string
  price_cad: number | null
  max_attendees: number | null
  available_slots: number | null
  duration_minutes: number | null
  date: string | null
  location: string | null
  status: string
  registration_closed?: boolean
  created_at: string
  description?: string | null
  image_url?: string | null
  workshop_series?: string | null
  series_occurrences?: unknown
  external_booked_count?: number | null
  partner_series_meta?: { pattern?: string; daily_js_weekdays?: number[]; weeks?: number } | null
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  published: { label: 'Published', className: 'bg-green-100 text-green-700' },
  draft: { label: 'Draft', className: 'bg-[#F0EDE8] text-[#888]' },
  fully_booked: { label: 'Fully Booked', className: 'bg-blue-100 text-blue-700' },
  archived: { label: 'Archived', className: 'bg-red-50 text-red-400' },
}

function SessionsPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [vendorDefaultAddress, setVendorDefaultAddress] = useState('')
  const [vendorDefaultLat, setVendorDefaultLat] = useState<number | null>(null)
  const [vendorDefaultLng, setVendorDefaultLng] = useState<number | null>(null)
  const [vendorDefaultWorkshopImageUrl, setVendorDefaultWorkshopImageUrl] = useState('')
  const [showForm, setShowForm] = useState(searchParams.get('new') === '1')
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(() => new Set())
  const [occurrenceEdit, setOccurrenceEdit] = useState<OccurrenceEditTarget | null>(null)

  function toggleExpanded(id: string) {
    setExpandedSessionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const url = statusFilter !== 'all' ? `/api/partners/sessions?status=${statusFilter}` : '/api/partners/sessions'
      const res = await fetch(url)
      const data = await res.json()
      setSessions(data.sessions ?? [])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId || sessions.length === 0) return
    const s = sessions.find((x) => String(x.id) === editId)
    if (s) {
      setEditingSession(s)
      setShowForm(true)
    }
  }, [searchParams, sessions])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/partners/profile')
        const data = await res.json()
        if (cancelled || !res.ok) return
        setVendorDefaultAddress(typeof data.location_address === 'string' ? data.location_address : '')
        const lat = data.location_lat
        const lng = data.location_lng
        setVendorDefaultLat(
          typeof lat === 'number' && Number.isFinite(lat) ? lat : null
        )
        setVendorDefaultLng(
          typeof lng === 'number' && Number.isFinite(lng) ? lng : null
        )
        setVendorDefaultWorkshopImageUrl(
          typeof data.default_workshop_image_url === 'string' ? data.default_workshop_image_url : ''
        )
      } catch {
        if (!cancelled) {
          setVendorDefaultAddress('')
          setVendorDefaultLat(null)
          setVendorDefaultLng(null)
          setVendorDefaultWorkshopImageUrl('')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleToggleRegistrationClosed(session: Session) {
    const closing = !session.registration_closed
    if (closing) {
      const ok = confirm(
        'Close registration for this workshop?\n\nIt will be hidden from the offhrs app and no new bookings will be accepted. Existing bookings are kept — no refunds.\n\nYou can reopen registration later.'
      )
      if (!ok) return
    } else if (
      !confirm(
        'Reopen registration?\n\nThis workshop will appear in the offhrs app again and accept new bookings based on remaining capacity.'
      )
    ) {
      return
    }
    const res = await fetch(`/api/partners/sessions/${session.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_closed: closing }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert((data as { error?: string }).error ?? 'Could not update registration status.')
      return
    }
    await fetchSessions()
  }

  async function handleToggleOccurrenceRegistrationClosed(
    session: Session,
    occurrenceStart: string,
    currentlyClosed: boolean
  ) {
    const closing = !currentlyClosed
    if (closing) {
      const ok = confirm(
        'Close registration for this session?\n\nIt will be hidden from the offhrs app. Existing bookings for this date are kept — no refunds.'
      )
      if (!ok) return
    } else if (
      !confirm('Reopen registration for this session? It will appear in the app again if spots remain.')
    ) {
      return
    }
    const res = await fetch(`/api/partners/sessions/${session.id}/occurrences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        occurrence_start: occurrenceStart,
        registration_closed: closing,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert((data as { error?: string }).error ?? 'Could not update registration status.')
      return
    }
    await fetchSessions()
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        'Archive this workshop? It will be hidden from the app and all active Offhrs bookings for this workshop will be fully refunded. The row stays in the database for booking history (filter by Archived to view).'
      )
    )
      return
    const res = await fetch(`/api/partners/sessions/${id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert((data as { error?: string }).error ?? 'Could not archive workshop.')
      return
    }
    await fetchSessions()
  }

  async function handleToggleStatus(session: Session) {
    const newStatus = session.status === 'published' ? 'draft' : 'published'
    await fetch(`/api/partners/sessions/${session.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    await fetchSessions()
  }

  function handleEdit(session: Session) {
    setEditingSession(session)
    setShowForm(true)
  }

  function handleFormClose() {
    setShowForm(false)
    setEditingSession(null)
    router.replace('/partners/dashboard/sessions')
    fetchSessions()
  }

  if (showForm || editingSession) {
    return (
      <SessionForm
        key={editingSession?.id ?? 'new'}
        session={editingSession}
        vendorDefaultAddress={vendorDefaultAddress}
        vendorDefaultLat={vendorDefaultLat}
        vendorDefaultLng={vendorDefaultLng}
        vendorDefaultWorkshopImageUrl={vendorDefaultWorkshopImageUrl}
        onClose={handleFormClose}
      />
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">Workshops</h1>
          <p className="text-sm text-[#888] mt-1">Manage your workshops.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#5D755D] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#4d644d] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New workshop
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {['all', 'published', 'draft', 'fully_booked', 'archived'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
              statusFilter === s
                ? 'bg-[#1a1a1a] text-white'
                : 'bg-[#F0EDE8] text-[#555] hover:bg-[#E8E4DE]'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_BADGE[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Workshop list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[#F5F2EE] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#E8E4DE] rounded-xl">
          <CalendarDays className="w-10 h-10 text-[#C8BFB0] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#1a1a1a]">No workshops yet</p>
          <p className="text-xs text-[#888] mt-1 mb-4">Create your first workshop to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-[#5D755D] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#4d644d] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create workshop
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const badge = STATUS_BADGE[session.status] ?? { label: session.status, className: 'bg-[#F0EDE8] text-[#888]' }
            const series = parseSeriesOccurrences(session as EventSeriesFields)
            const isMulti = series.length > 1
            const pattern = session.partner_series_meta?.pattern
            const isPerOccurrenceSeries = isMulti && pattern === 'daily_weekdays'
            const registrationClosed = session.registration_closed === true
            const closedOccurrenceCount = isPerOccurrenceSeries
              ? series.filter((o) => o.registration_closed).length
              : 0
            const countBadgeLabel = isMulti
              ? pattern === 'daily_weekdays'
                ? `${series.length} session${series.length === 1 ? '' : 's'}`
                : `${series.length} week${series.length === 1 ? '' : 's'}`
              : null
            const expanded = expandedSessionIds.has(session.id)
            const perOccurrenceFilled = isPerOccurrenceSeries
              ? series.reduce((sum, occ) => {
                  const cap = occ.max_attendees ?? 0
                  const remaining = occ.available_slots ?? cap
                  return sum + Math.max(0, Math.min(cap, cap - remaining))
                }, 0)
              : null
            return (
              <div
                key={session.id}
                className="bg-white border border-[#E8E4DE] rounded-xl hover:border-[#C8BFB0] transition-colors"
              >
                <div className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-[#1a1a1a] truncate">{session.title}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${badge.className}`}>
                        {badge.label}
                      </span>
                      {registrationClosed && session.status !== 'archived' && !isPerOccurrenceSeries && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 bg-amber-100 text-amber-800">
                          Registration closed
                        </span>
                      )}
                      {closedOccurrenceCount > 0 && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 bg-amber-100 text-amber-800">
                          {closedOccurrenceCount} session{closedOccurrenceCount === 1 ? '' : 's'} closed
                        </span>
                      )}
                      {countBadgeLabel && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 bg-[#EDF2ED] text-[#5D755D]">
                          {countBadgeLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#888]">
                      {session.price_cad !== null && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {session.price_cad === 0 ? 'Free' : `${session.price_cad} CAD`}
                        </span>
                      )}
                      {session.max_attendees !== null && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {isPerOccurrenceSeries
                            ? `${perOccurrenceFilled ?? 0} total spots filled`
                            : spotsFilledLabel(session.max_attendees, session.available_slots)}
                        </span>
                      )}
                      {session.duration_minutes !== null && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {session.duration_minutes} min
                        </span>
                      )}
                      {session.date && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {isMulti && series.length > 0
                            ? formatSeriesDateRangeLabel(series)
                            : new Date(session.date).toLocaleDateString('en-CA', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isPerOccurrenceSeries && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(session.id)}
                        aria-expanded={expanded}
                        aria-controls={`session-occurrences-${session.id}`}
                        title={expanded ? 'Hide session breakdown' : 'Show per-session capacity'}
                        className="p-2 rounded-lg text-[#888] hover:bg-[#F0EDE8] hover:text-[#1a1a1a] transition-colors"
                      >
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                    {!isPerOccurrenceSeries ? (
                      <button
                        type="button"
                        onClick={() => handleToggleRegistrationClosed(session)}
                        title={
                          registrationClosed
                            ? 'Reopen registration'
                            : 'Close registration (hide from app, keep existing bookings)'
                        }
                        disabled={session.status === 'archived' || session.status === 'draft'}
                        className={`p-2 rounded-lg transition-colors ${
                          registrationClosed
                            ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                            : 'text-[#888] hover:bg-[#F0EDE8] hover:text-[#1a1a1a]'
                        } disabled:opacity-40 disabled:pointer-events-none`}
                      >
                        {registrationClosed ? (
                          <Lock className="w-4 h-4" />
                        ) : (
                          <LockOpen className="w-4 h-4" />
                        )}
                      </button>
                    ) : null}
                    <button
                      onClick={() => handleToggleStatus(session)}
                      title={session.status === 'published' ? 'Unpublish' : 'Publish'}
                      className="p-2 rounded-lg text-[#888] hover:bg-[#F0EDE8] hover:text-[#1a1a1a] transition-colors"
                      disabled={session.status === 'fully_booked' || session.status === 'archived'}
                    >
                      {session.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleEdit(session)}
                      title="Edit"
                      className="p-2 rounded-lg text-[#888] hover:bg-[#F0EDE8] hover:text-[#1a1a1a] transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(session.id)}
                      title="Archive"
                      className="p-2 rounded-lg text-[#888] hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {isPerOccurrenceSeries && expanded && (
                  <div
                    id={`session-occurrences-${session.id}`}
                    className="border-t border-[#F0EDE8] px-4 py-3"
                  >
                    <p className="text-xs font-medium text-[#888] uppercase tracking-wide mb-2">
                      Per-session capacity &amp; registration
                    </p>
                    <ul className="divide-y divide-[#F5F2EE]">
                      {series.map((occ, idx) => {
                        const startDate = new Date(occ.start)
                        const label = Number.isNaN(startDate.getTime())
                          ? `Session ${idx + 1}`
                          : startDate.toLocaleString('en-CA', {
                              timeZone: 'America/Toronto',
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                        return (
                          <li
                            key={`${session.id}-occ-${idx}-${occ.start}`}
                            className="flex items-center justify-between gap-3 py-1.5 text-xs"
                          >
                            <span className="text-[#1a1a1a] truncate">{label}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {occ.registration_closed ? (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                  Closed
                                </span>
                              ) : null}
                              <span className="text-[#555]">
                                {spotsFilledLabel(occ.max_attendees, occ.available_slots)}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleOccurrenceRegistrationClosed(
                                    session,
                                    occ.start,
                                    occ.registration_closed === true
                                  )
                                }
                                title={
                                  occ.registration_closed
                                    ? 'Reopen registration for this session'
                                    : 'Close registration for this session'
                                }
                                disabled={session.status === 'archived'}
                                className={`p-1.5 rounded-md transition-colors ${
                                  occ.registration_closed
                                    ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                    : 'text-[#888] hover:bg-[#F0EDE8] hover:text-[#1a1a1a]'
                                } disabled:opacity-40`}
                              >
                                {occ.registration_closed ? (
                                  <Lock className="w-3.5 h-3.5" />
                                ) : (
                                  <LockOpen className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setOccurrenceEdit({
                                    sessionId: session.id,
                                    sessionTitle: session.title,
                                    occurrence: occ,
                                  })
                                }
                                title="Edit this session"
                                className="p-1.5 rounded-md text-[#888] hover:bg-[#F0EDE8] hover:text-[#1a1a1a]"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <OccurrenceEditModal
        target={occurrenceEdit}
        onClose={() => setOccurrenceEdit(null)}
        onSaved={() => void fetchSessions()}
      />
    </div>
  )
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#888]">Loading workshops…</div>}>
      <SessionsPageInner />
    </Suspense>
  )
}
