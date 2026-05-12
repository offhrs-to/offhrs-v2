'use client'

import { useEffect, useState, useCallback } from 'react'
import { Download, Users, RefreshCw, RotateCcw } from 'lucide-react'

interface Booking {
  id: string
  name: string | null
  email: string | null
  amount_cad: number | null
  stripe_fee_cad: number | null
  net_vendor_cad: number | null
  stripe_charge_id: string | null
  status: string | null
  refunded_at: string | null
  created_at: string
  event_id: string | null
  events: { title?: string } | null
}

interface Session { id: string; title: string }

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-600' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  refunded: { label: 'Refunded', className: 'bg-[#F0EDE8] text-[#888]' },
}

function formatCad(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export function BookingsClient({ sessions }: { sessions: Session[] }) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [sessionFilter, setSessionFilter] = useState('all')
  const [refundingId, setRefundingId] = useState<string | null>(null)

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (sessionFilter !== 'all') params.set('session_id', sessionFilter)
    const res = await fetch(`/api/partners/bookings?${params}`)
    const data = await res.json()
    setBookings(data.bookings ?? [])
    setLoading(false)
  }, [statusFilter, sessionFilter])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  async function handleExportCsv() {
    const params = new URLSearchParams({ format: 'csv' })
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (sessionFilter !== 'all') params.set('session_id', sessionFilter)
    const res = await fetch(`/api/partners/bookings?${params}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleRefund(bookingId: string, attendeeName: string) {
    if (!confirm(`Issue a full refund for ${attendeeName ?? 'this booking'}? This cannot be undone.`)) return
    setRefundingId(bookingId)
    try {
      const res = await fetch(`/api/partners/bookings/${bookingId}/refund`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Refund failed.')
      } else {
        await fetchBookings()
      }
    } catch {
      alert('Refund request failed. Please try again.')
    } finally {
      setRefundingId(null)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">Bookings</h1>
          <p className="text-sm text-[#888] mt-1">
            {bookings.length} booking{bookings.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 text-sm font-semibold text-[#5D755D] border border-[#5D755D] px-4 py-2.5 rounded-xl hover:bg-[#EDF2ED] transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-[#E8E4DE] rounded-xl px-3 py-2 bg-white text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
        >
          <option value="all">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
          <option value="pending">Pending</option>
        </select>

        <select
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          className="text-sm border border-[#E8E4DE] rounded-xl px-3 py-2 bg-white text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
        >
          <option value="all">All sessions</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>

        <button
          onClick={fetchBookings}
          className="flex items-center gap-1.5 text-sm text-[#888] border border-[#E8E4DE] px-3 py-2 rounded-xl hover:bg-[#F5F2EE] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-[#F5F2EE] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !bookings.length ? (
        <div className="text-center py-16 bg-white border border-[#E8E4DE] rounded-xl">
          <Users className="w-10 h-10 text-[#C8BFB0] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#1a1a1a]">No bookings found</p>
          <p className="text-xs text-[#888] mt-1">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E8E4DE] rounded-xl overflow-hidden">
          {/* Desktop header */}
          <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3 border-b border-[#F0EDE8] text-xs font-medium text-[#888]">
            <span>Attendee</span>
            <span>Session</span>
            <span>Date</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {bookings.map((b) => {
            const badge = STATUS_BADGE[b.status ?? ''] ?? { label: b.status ?? '—', className: 'bg-[#F0EDE8] text-[#888]' }
            const canRefund = b.status === 'confirmed' && !b.refunded_at
            return (
              <div
                key={b.id}
                className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3.5 border-b border-[#F5F2EE] last:border-0 items-center"
              >
                {/* Attendee */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1a1a1a] truncate">{b.name ?? 'Guest'}</p>
                  <p className="text-xs text-[#888] truncate">{b.email ?? ''}</p>
                </div>

                {/* Session */}
                <p className="text-sm text-[#555] truncate">{b.events?.title ?? '—'}</p>

                {/* Date */}
                <p className="text-sm text-[#555]">
                  {new Date(b.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                </p>

                {/* Amount */}
                <div>
                  <p className="text-sm font-medium text-[#1a1a1a]">
                    {b.amount_cad ? formatCad(b.amount_cad) : '—'}
                  </p>
                  {b.net_vendor_cad && (
                    <p className="text-xs text-[#888]">net {formatCad(b.net_vendor_cad)}</p>
                  )}
                </div>

                {/* Status */}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${badge.className}`}>
                  {badge.label}
                </span>

                {/* Refund */}
                <div>
                  {canRefund ? (
                    <button
                      onClick={() => handleRefund(b.id, b.name ?? 'Guest')}
                      disabled={refundingId === b.id}
                      className="flex items-center gap-1.5 text-xs font-semibold text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {refundingId === b.id ? 'Processing…' : 'Refund'}
                    </button>
                  ) : (
                    <span className="text-xs text-[#C8BFB0]">—</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
