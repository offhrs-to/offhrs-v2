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
import { workshopHasActiveSale, formatCadMoney } from '@/lib/workshop-ticket-price'
import { WORKSHOP_TIMEZONE } from '@/lib/workshop-timezone'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PartnerEmptyState } from '../components/PartnerEmptyState'
import { cn } from '@/lib/utils'

interface Session {
  id: string
  title: string
  category: string
  price_cad: number | null
  sale_price_cad?: number | null
  sale_starts_on?: string | null
  sale_ends_on?: string | null
  max_attendees: number | null
  available_slots: number | null
  duration_minutes: number | null
  date: string | null
  location: string | null
  location_unit?: string | null
  status: string
  registration_closed?: boolean
  created_at: string
  description?: string | null
  workshop_experience?: string | null
  workshop_experience_hidden?: boolean | null
  workshop_materials_takeaway?: string | null
  workshop_materials_takeaway_hidden?: boolean | null
  workshop_skill_level?: string | null
  workshop_skill_level_hidden?: boolean | null
  image_url?: string | null
  workshop_series?: string | null
  series_occurrences?: unknown
  external_booked_count?: number | null
  partner_series_meta?: { pattern?: string; daily_js_weekdays?: number[]; weeks?: number } | null
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  published: { label: 'Published', className: 'border-transparent bg-green-100 text-green-700' },
  draft: { label: 'Draft', className: 'border-transparent bg-partner-muted text-muted-foreground' },
  fully_booked: { label: 'Fully Booked', className: 'border-transparent bg-blue-100 text-blue-700' },
  archived: { label: 'Archived', className: 'border-transparent bg-red-50 text-red-400' },
}

type BulkAction = 'publish' | 'draft' | 'archive'

const BULK_ACTION_LABEL: Record<BulkAction, string> = {
  publish: 'Publish',
  draft: 'Move to draft',
  archive: 'Archive',
}

/** Single-session date + time for the workshop list (America/Toronto). */
function formatWorkshopListDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: WORKSHOP_TIMEZONE,
  })
}

function SessionsPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [vendorDefaultAddress, setVendorDefaultAddress] = useState('')
  const [vendorDefaultUnit, setVendorDefaultUnit] = useState('')
  const [vendorDefaultLat, setVendorDefaultLat] = useState<number | null>(null)
  const [vendorDefaultLng, setVendorDefaultLng] = useState<number | null>(null)
  const [vendorDefaultWorkshopImageUrl, setVendorDefaultWorkshopImageUrl] = useState('')
  const [showForm, setShowForm] = useState(searchParams.get('new') === '1')
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(() => new Set())
  const [occurrenceEdit, setOccurrenceEdit] = useState<OccurrenceEditTarget | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkAction, setBulkAction] = useState<BulkAction | ''>('')
  const [bulkApplying, setBulkApplying] = useState(false)

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
      setSessions(
        (data.sessions ?? []).map((s: Session & { id: string | number }) => ({
          ...s,
          id: String(s.id),
        }))
      )
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  useEffect(() => {
    setSelectedIds(new Set())
    setBulkAction('')
  }, [statusFilter])

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
        setVendorDefaultUnit(typeof data.location_unit === 'string' ? data.location_unit : '')
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
          setVendorDefaultUnit('')
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

  const visibleIds = sessions.map((s) => s.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id))

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleIds))
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkApply() {
    if (!bulkAction || selectedIds.size === 0) return

    if (bulkAction === 'archive') {
      const ok = confirm(
        `Archive ${selectedIds.size} selected workshop${selectedIds.size === 1 ? '' : 's'}?\n\nThey will be hidden from the app and all active Offhrs bookings for those workshops will be fully refunded. Archived rows stay in your dashboard for booking history.`
      )
      if (!ok) return
    }

    setBulkApplying(true)
    try {
      const res = await fetch('/api/partners/sessions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: [...selectedIds].map((id) => String(id)),
          action: bulkAction,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        fields?: Record<string, string[] | undefined>
        succeeded?: string[]
        skipped?: { id: string; reason: string }[]
        failed?: { id: string; error: string }[]
        refunded?: number
      }
      if (!res.ok) {
        const fieldMsg = data.fields
          ? Object.entries(data.fields)
              .flatMap(([k, v]) => (v ?? []).map((m) => `${k}: ${m}`))
              .join('\n')
          : ''
        alert([data.error ?? 'Bulk action failed.', fieldMsg].filter(Boolean).join('\n'))
        return
      }

      const parts: string[] = []
      if (data.succeeded?.length) {
        parts.push(`${data.succeeded.length} updated`)
      }
      if (data.skipped?.length) {
        const reasonLines = data.skipped
          .slice(0, 6)
          .map((s) => {
            const title =
              sessions.find((w) => String(w.id) === String(s.id))?.title?.trim() || `Workshop ${s.id}`
            return `• ${title}: ${s.reason}`
          })
          .join('\n')
        parts.push(
          reasonLines
            ? `${data.skipped.length} skipped:\n${reasonLines}`
            : `${data.skipped.length} skipped`
        )
      }
      if (data.failed?.length) {
        const reasonLines = data.failed
          .slice(0, 6)
          .map((f) => {
            const title =
              sessions.find((w) => String(w.id) === String(f.id))?.title?.trim() || `Workshop ${f.id}`
            return `• ${title}: ${f.error}`
          })
          .join('\n')
        parts.push(
          reasonLines
            ? `${data.failed.length} failed:\n${reasonLines}`
            : `${data.failed.length} failed`
        )
      }
      if (typeof data.refunded === 'number' && data.refunded > 0) {
        parts.push(`${data.refunded} booking${data.refunded === 1 ? '' : 's'} refunded`)
      }
      if (parts.length > 0) {
        alert(parts.join(' · '))
      }

      setSelectedIds(new Set())
      setBulkAction('')
      await fetchSessions()
    } finally {
      setBulkApplying(false)
    }
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
        vendorDefaultUnit={vendorDefaultUnit}
        vendorDefaultLat={vendorDefaultLat}
        vendorDefaultLng={vendorDefaultLng}
        vendorDefaultWorkshopImageUrl={vendorDefaultWorkshopImageUrl}
        onClose={handleFormClose}
      />
    )
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workshops</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your workshops.</p>
        </div>
        <Button type="button" onClick={() => setShowForm(true)} className="self-start">
          <Plus className="size-4" />
          New workshop
        </Button>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {['all', 'published', 'draft', 'fully_booked', 'archived'].map((s) => (
          <Button
            key={s}
            type="button"
            variant={statusFilter === s ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setStatusFilter(s)}
            className={cn(
              'h-8 shrink-0 rounded-full text-xs',
              statusFilter === s
                ? 'bg-foreground text-white hover:bg-foreground/90'
                : 'bg-partner-muted text-muted-foreground hover:bg-partner-border'
            )}
          >
            {s === 'all' ? 'All' : STATUS_BADGE[s]?.label ?? s}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-partner-muted" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-partner-border py-0 shadow-none">
          <PartnerEmptyState
            icon={CalendarDays}
            title="No workshops yet"
            description="Create your first workshop to get started."
            action={
              <Button type="button" onClick={() => setShowForm(true)}>
                <Plus className="size-4" />
                Create workshop
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-xl border border-partner-border bg-partner-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected
                }}
                onChange={toggleSelectAll}
                className="size-4 rounded border-partner-border"
                aria-label="Select all visible workshops"
              />
              <span>
                {selectedIds.size > 0
                  ? `${selectedIds.size} selected`
                  : 'Select workshops for bulk actions'}
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={bulkAction || undefined}
                onValueChange={(value) => setBulkAction(value as BulkAction)}
                disabled={selectedIds.size === 0 || bulkApplying}
              >
                <SelectTrigger size="sm" className="min-w-[10rem] bg-background">
                  <SelectValue placeholder="Change status…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="publish">{BULK_ACTION_LABEL.publish}</SelectItem>
                  <SelectItem value="draft">{BULK_ACTION_LABEL.draft}</SelectItem>
                  <SelectItem value="archive">{BULK_ACTION_LABEL.archive}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleBulkApply()}
                disabled={!bulkAction || selectedIds.size === 0 || bulkApplying}
              >
                {bulkApplying ? 'Applying…' : 'Apply'}
              </Button>
              {selectedIds.size > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedIds(new Set())
                    setBulkAction('')
                  }}
                  disabled={bulkApplying}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
          {sessions.map((session) => {
            const badge = STATUS_BADGE[session.status] ?? {
              label: session.status,
              className: 'border-transparent bg-partner-muted text-muted-foreground',
            }
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
              <Card
                key={session.id}
                className="gap-0 border-partner-border py-0 shadow-none transition-colors hover:border-muted-foreground/30"
              >
                <div className="flex items-center gap-4 p-4">
                  <label className="flex shrink-0 items-start pt-0.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(session.id)}
                      onChange={() => toggleSelected(session.id)}
                      className="size-4 rounded border-partner-border"
                      aria-label={`Select ${session.title}`}
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-foreground">{session.title}</h3>
                      <Badge variant="outline" className={cn('shrink-0', badge.className)}>
                        {badge.label}
                      </Badge>
                      {registrationClosed && session.status !== 'archived' && !isPerOccurrenceSeries && (
                        <Badge className="shrink-0 border-transparent bg-amber-100 text-amber-800">
                          Registration closed
                        </Badge>
                      )}
                      {closedOccurrenceCount > 0 && (
                        <Badge className="shrink-0 border-transparent bg-amber-100 text-amber-800">
                          {closedOccurrenceCount} session{closedOccurrenceCount === 1 ? '' : 's'} closed
                        </Badge>
                      )}
                      {countBadgeLabel && (
                        <Badge className="shrink-0 border-transparent bg-partner-tint text-primary">
                          {countBadgeLabel}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {session.price_cad !== null && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {session.price_cad === 0 ? (
                            'Free'
                          ) : workshopHasActiveSale(session) ? (
                            <>
                              <span className="line-through text-muted-foreground/70">
                                {formatCadMoney(Number(session.price_cad))} CAD
                              </span>
                              <span className="text-red-600 font-semibold">
                                {formatCadMoney(Number(session.sale_price_cad))} CAD
                              </span>
                            </>
                          ) : session.sale_price_cad != null &&
                            Number(session.sale_price_cad) >= 0 &&
                            Number(session.sale_price_cad) < Number(session.price_cad) ? (
                            <>
                              <span>{formatCadMoney(Number(session.price_cad))} CAD</span>
                              <span className="text-muted-foreground">
                                {' '}
                                (sale {formatCadMoney(Number(session.sale_price_cad))} CAD
                                {session.sale_ends_on
                                  ? ` until ${String(session.sale_ends_on).slice(0, 10)}`
                                  : ''}
                                )
                              </span>
                            </>
                          ) : (
                            `${formatCadMoney(Number(session.price_cad))} CAD`
                          )}
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
                            : formatWorkshopListDateTime(session.date)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {isPerOccurrenceSeries && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleExpanded(session.id)}
                        aria-expanded={expanded}
                        aria-controls={`session-occurrences-${session.id}`}
                        title={expanded ? 'Hide session breakdown' : 'Show per-session capacity'}
                        className="text-muted-foreground"
                      >
                        {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </Button>
                    )}
                    {!isPerOccurrenceSeries ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggleRegistrationClosed(session)}
                        title={
                          registrationClosed
                            ? 'Reopen registration'
                            : 'Close registration (hide from app, keep existing bookings)'
                        }
                        disabled={session.status === 'archived' || session.status === 'draft'}
                        className={cn(
                          registrationClosed
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'text-muted-foreground'
                        )}
                      >
                        {registrationClosed ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleToggleStatus(session)}
                      title={session.status === 'published' ? 'Unpublish' : 'Publish'}
                      className="text-muted-foreground"
                      disabled={session.status === 'fully_booked' || session.status === 'archived'}
                    >
                      {session.status === 'published' ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleEdit(session)}
                      title="Edit"
                      className="text-muted-foreground"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(session.id)}
                      title="Archive"
                      className="text-muted-foreground hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                {isPerOccurrenceSeries && expanded && (
                  <div
                    id={`session-occurrences-${session.id}`}
                    className="border-t border-partner-border px-4 py-3"
                  >
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Per-session capacity &amp; registration
                    </p>
                    <ul className="divide-y divide-partner-border/80">
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
                            <span className="truncate text-foreground">{label}</span>
                            <div className="flex shrink-0 items-center gap-2">
                              {occ.registration_closed ? (
                                <Badge className="border-transparent bg-amber-100 text-[10px] text-amber-800">
                                  Closed
                                </Badge>
                              ) : null}
                              <span className="text-muted-foreground">
                                {spotsFilledLabel(occ.max_attendees, occ.available_slots)}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
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
                                className={cn(
                                  'size-8',
                                  occ.registration_closed
                                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                    : 'text-muted-foreground'
                                )}
                              >
                                {occ.registration_closed ? (
                                  <Lock className="size-3.5" />
                                ) : (
                                  <LockOpen className="size-3.5" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() =>
                                  setOccurrenceEdit({
                                    sessionId: session.id,
                                    sessionTitle: session.title,
                                    occurrence: occ,
                                    parent: {
                                      title: session.title,
                                      duration_minutes: session.duration_minutes,
                                      location: session.location,
                                      price_cad: session.price_cad,
                                      sale_price_cad: session.sale_price_cad ?? null,
                                    },
                                  })
                                }
                                title="Edit this session"
                                className="size-8 text-muted-foreground"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </Card>
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
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading workshops…</div>}>
      <SessionsPageInner />
    </Suspense>
  )
}
