'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, RefreshCw, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PartnerEmptyState } from '../components/PartnerEmptyState'
import { cn } from '@/lib/utils'

type ClientRow = {
  key: string
  display_name: string
  email: string
  phone: string | null
  workshops: { id: string; title: string }[]
  first_enrolled_at: string
  booking_count: number
  review: { rating: number; comment: string | null; created_at: string } | null
}

type WorkshopOption = { id: string; title: string }

const PAGE_SIZE = 25

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'first_enrolled_at', label: 'First enrolled (newest)' },
  { value: 'first_enrolled_at_asc', label: 'First enrolled (oldest)' },
  { value: 'display_name', label: 'Name (A–Z)' },
  { value: 'display_name_desc', label: 'Name (Z–A)' },
  { value: 'email', label: 'Email (A–Z)' },
  { value: 'workshop', label: 'Workshop (A–Z)' },
  { value: 'review', label: 'Review rating (high)' },
  { value: 'review_asc', label: 'Review rating (low)' },
  { value: 'phone', label: 'Phone (A–Z)' },
]

const selectClass =
  'h-9 w-full rounded-md border border-partner-border bg-white px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatEnrolled(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ClientsClient() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [workshopOptions, setWorkshopOptions] = useState<WorkshopOption[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [sortChoice, setSortChoice] = useState('first_enrolled_at')
  const [workshopId, setWorkshopId] = useState('')
  const [hasReview, setHasReview] = useState('')
  const [hasPhone, setHasPhone] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const sortParam = useMemo(() => {
    if (sortChoice === 'first_enrolled_at_asc') return { sort: 'first_enrolled_at', dir: 'asc' as const }
    if (sortChoice === 'display_name_desc') return { sort: 'display_name', dir: 'desc' as const }
    if (sortChoice === 'review_asc') return { sort: 'review', dir: 'asc' as const }
    if (sortChoice === 'first_enrolled_at') return { sort: 'first_enrolled_at', dir: 'desc' as const }
    if (sortChoice === 'display_name') return { sort: 'display_name', dir: 'asc' as const }
    if (sortChoice === 'email') return { sort: 'email', dir: 'asc' as const }
    if (sortChoice === 'workshop') return { sort: 'workshop', dir: 'asc' as const }
    if (sortChoice === 'review') return { sort: 'review', dir: 'desc' as const }
    if (sortChoice === 'phone') return { sort: 'phone', dir: 'asc' as const }
    return { sort: 'first_enrolled_at', dir: 'desc' as const }
  }, [sortChoice])

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (qDebounced) params.set('q', qDebounced)
      params.set('sort', sortParam.sort)
      params.set('dir', sortParam.dir)
      if (workshopId) params.set('workshop_id', workshopId)
      if (hasReview === 'yes') params.set('has_review', '1')
      if (hasReview === 'no') params.set('has_review', '0')
      if (hasPhone === 'yes') params.set('has_phone', '1')
      if (hasPhone === 'no') params.set('has_phone', '0')
      const res = await fetch(`/api/partners/clients?${params}`)
      const data = (await res.json()) as {
        clients?: ClientRow[]
        workshop_options?: WorkshopOption[]
        meta?: { total?: number }
        error?: string
      }
      if (!res.ok) {
        setClients([])
        setWorkshopOptions([])
        return
      }
      setClients(data.clients ?? [])
      setWorkshopOptions(data.workshop_options ?? [])
      setPage(1)
    } finally {
      setLoading(false)
    }
  }, [qDebounced, sortParam.sort, sortParam.dir, workshopId, hasReview, hasPhone])

  useEffect(() => {
    void fetchClients()
  }, [fetchClients])

  const pageCount = Math.max(1, Math.ceil(clients.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const sliceStart = (safePage - 1) * PAGE_SIZE
  const pageRows = clients.slice(sliceStart, sliceStart + PAGE_SIZE)
  const fromN = clients.length === 0 ? 0 : sliceStart + 1
  const toN = Math.min(sliceStart + PAGE_SIZE, clients.length)

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            Clients
            <Badge variant="secondary" className="font-medium text-muted-foreground">
              {loading ? '…' : clients.length}
            </Badge>
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            People who booked your workshops. Search by name, email, or phone. Use filters and sort to narrow the
            list.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void fetchClients()}
          className="shrink-0 border-partner-border"
        >
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" aria-hidden />
          <Input
            type="search"
            placeholder="Name, email or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-10 border-partner-border bg-white pl-10 shadow-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'h-10 border-partner-border',
              showFilters && 'border-primary bg-partner-tint text-primary'
            )}
          >
            <SlidersHorizontal className="size-4" />
            Filters
          </Button>
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
            <span className="hidden sm:inline">Sort</span>
            <select
              value={sortChoice}
              onChange={(e) => setSortChoice(e.target.value)}
              className={cn(selectClass, 'min-w-[12rem]')}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {showFilters && (
        <Card className="mb-5 grid gap-4 border-partner-border p-4 shadow-none sm:grid-cols-3">
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Workshop</Label>
            <select value={workshopId} onChange={(e) => setWorkshopId(e.target.value)} className={selectClass}>
              <option value="">All workshops</option>
              {workshopOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Review</Label>
            <select value={hasReview} onChange={(e) => setHasReview(e.target.value)} className={selectClass}>
              <option value="">Any</option>
              <option value="yes">Has review</option>
              <option value="no">No review</option>
            </select>
          </div>
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Phone on file</Label>
            <select value={hasPhone} onChange={(e) => setHasPhone(e.target.value)} className={selectClass}>
              <option value="">Any</option>
              <option value="yes">Has phone</option>
              <option value="no">No phone</option>
            </select>
          </div>
        </Card>
      )}

      <Card className="gap-0 overflow-hidden border-partner-border py-0 shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-partner-border bg-partner-canvas text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="w-[28%] px-4 py-3">Client</th>
                <th className="w-[14%] px-4 py-3">Mobile</th>
                <th className="w-[18%] px-4 py-3">Reviews</th>
                <th className="w-[26%] px-4 py-3">Workshop</th>
                <th className="w-[14%] whitespace-nowrap px-4 py-3">First enrolled</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    Loading clients…
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <PartnerEmptyState
                      icon={Search}
                      title="No clients yet"
                      description="When someone books a workshop, they will appear here."
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((c) => (
                  <tr
                    key={c.key}
                    className="border-b border-partner-border last:border-0 hover:bg-partner-canvas/80"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-partner-tint text-[11px] font-semibold text-primary"
                          aria-hidden
                        >
                          {initials(c.display_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{c.display_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                          {c.booking_count > 1 && (
                            <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                              {c.booking_count} bookings
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">
                      {c.phone ?? '—'}
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {c.review ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-amber-600">
                            <Star className="size-3.5 fill-current" aria-hidden />
                            <span className="text-xs font-semibold">{c.review.rating}/5</span>
                          </div>
                          {c.review.comment ? (
                            <p className="line-clamp-2 text-xs text-muted-foreground" title={c.review.comment}>
                              {c.review.comment}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {c.workshops.length === 0 ? (
                        '—'
                      ) : c.workshops.length === 1 ? (
                        <span className="line-clamp-2" title={c.workshops[0].title}>
                          {c.workshops[0].title}
                        </span>
                      ) : (
                        <span title={c.workshops.map((w) => w.title).join(', ')}>
                          <span className="line-clamp-1">{c.workshops[0].title}</span>
                          <span className="text-xs text-muted-foreground"> +{c.workshops.length - 1} more</span>
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">
                      {formatEnrolled(c.first_enrolled_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && clients.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-partner-border bg-partner-canvas px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Viewing {fromN}–{toN} of {clients.length} results
            </span>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 border-partner-border"
                >
                  Previous
                </Button>
                <span className="text-muted-foreground">
                  Page {safePage} / {pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  className="h-8 border-partner-border"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-muted-foreground/70">
        Reviews show when a signed-in customer left a review linked to your partner profile. Phone appears when their
        offhrs profile includes a number and we can match their account to a booking.
      </p>
    </div>
  )
}
