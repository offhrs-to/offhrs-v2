'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, RefreshCw, Star } from 'lucide-react'

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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a1a1a] flex flex-wrap items-center gap-2">
            Clients
            <span className="text-xs font-medium text-[#888] bg-[#F0EDE8] px-2 py-0.5 rounded-full">
              {loading ? '…' : clients.length}
            </span>
          </h1>
          <p className="text-sm text-[#888] mt-1 max-w-xl">
            People who booked your workshops. Search by name, email, or phone. Use filters and sort to narrow the list.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void fetchClients()}
            className="flex items-center gap-2 text-sm font-medium text-[#555] border border-[#E8E4DE] px-3 py-2 rounded-xl hover:bg-[#F5F2EE] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#aaa]" aria-hidden />
          <input
            type="search"
            placeholder="Name, email or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D] focus:border-transparent"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-2.5 rounded-xl border transition-colors ${
              showFilters ? 'border-[#5D755D] bg-[#EDF2ED] text-[#3d523d]' : 'border-[#E8E4DE] text-[#555] hover:bg-[#F5F2EE]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>
          <label className="flex items-center gap-2 text-sm text-[#555] whitespace-nowrap">
            <span className="text-[#888] hidden sm:inline">Sort</span>
            <select
              value={sortChoice}
              onChange={(e) => setSortChoice(e.target.value)}
              className="border border-[#E8E4DE] rounded-xl px-3 py-2.5 text-sm bg-white text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#5D755D] min-w-[12rem]"
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
        <div className="mb-5 p-4 rounded-xl border border-[#E8E4DE] bg-white grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#888] mb-1.5">Workshop</label>
            <select
              value={workshopId}
              onChange={(e) => setWorkshopId(e.target.value)}
              className="w-full border border-[#E8E4DE] rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">All workshops</option>
              {workshopOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#888] mb-1.5">Review</label>
            <select
              value={hasReview}
              onChange={(e) => setHasReview(e.target.value)}
              className="w-full border border-[#E8E4DE] rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Any</option>
              <option value="yes">Has review</option>
              <option value="no">No review</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#888] mb-1.5">Phone on file</label>
            <select
              value={hasPhone}
              onChange={(e) => setHasPhone(e.target.value)}
              className="w-full border border-[#E8E4DE] rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Any</option>
              <option value="yes">Has phone</option>
              <option value="no">No phone</option>
            </select>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#E8E4DE] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-[#E8E4DE] bg-[#FAFAF8] text-left text-xs font-semibold text-[#888] uppercase tracking-wide">
                <th className="px-4 py-3 w-[28%]">Client</th>
                <th className="px-4 py-3 w-[14%]">Mobile</th>
                <th className="px-4 py-3 w-[18%]">Reviews</th>
                <th className="px-4 py-3 w-[26%]">Workshop</th>
                <th className="px-4 py-3 w-[14%] whitespace-nowrap">First enrolled</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[#888]">
                    Loading clients…
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[#888]">
                    No clients yet. When someone books a workshop, they will appear here.
                  </td>
                </tr>
              ) : (
                pageRows.map((c) => (
                  <tr key={c.key} className="border-b border-[#F0EDE8] last:border-0 hover:bg-[#FAFAF8]/80">
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDF2ED] text-[11px] font-semibold text-[#5D755D]"
                          aria-hidden
                        >
                          {initials(c.display_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[#1a1a1a] truncate">{c.display_name}</p>
                          <p className="text-xs text-[#888] truncate">{c.email}</p>
                          {c.booking_count > 1 && (
                            <p className="text-[10px] text-[#aaa] mt-0.5">{c.booking_count} bookings</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-[#555] whitespace-nowrap">
                      {c.phone ?? '—'}
                    </td>
                    <td className="px-4 py-3 align-top text-[#555]">
                      {c.review ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-amber-600">
                            <Star className="w-3.5 h-3.5 fill-current" aria-hidden />
                            <span className="text-xs font-semibold">{c.review.rating}/5</span>
                          </div>
                          {c.review.comment ? (
                            <p className="text-xs text-[#888] line-clamp-2" title={c.review.comment}>
                              {c.review.comment}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-[#555]">
                      {c.workshops.length === 0 ? (
                        '—'
                      ) : c.workshops.length === 1 ? (
                        <span className="line-clamp-2" title={c.workshops[0].title}>
                          {c.workshops[0].title}
                        </span>
                      ) : (
                        <span title={c.workshops.map((w) => w.title).join(', ')}>
                          <span className="line-clamp-1">{c.workshops[0].title}</span>
                          <span className="text-xs text-[#888]"> +{c.workshops.length - 1} more</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-[#555] whitespace-nowrap">{formatEnrolled(c.first_enrolled_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && clients.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-[#E8E4DE] bg-[#FAFAF8] text-xs text-[#888]">
            <span>
              Viewing {fromN}–{toN} of {clients.length} results
            </span>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded-lg border border-[#E8E4DE] text-[#555] disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-[#555]">
                  Page {safePage} / {pageCount}
                </span>
                <button
                  type="button"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  className="px-2 py-1 rounded-lg border border-[#E8E4DE] text-[#555] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-[#aaa] mt-4">
        Reviews show when a signed-in customer left a review linked to your partner profile. Phone appears when their
        offhrs profile includes a number and we can match their account to a booking.
      </p>
    </div>
  )
}
