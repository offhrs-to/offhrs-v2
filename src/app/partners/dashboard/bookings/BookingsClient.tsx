'use client'

import { useEffect, useState, useCallback } from 'react'
import { Download, Users, RefreshCw, RotateCcw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PartnerEmptyState } from '../components/PartnerEmptyState'
import { cn } from '@/lib/utils'

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

interface Session {
  id: string
  title: string
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  confirmed: { label: 'Confirmed', className: 'border-transparent bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', className: 'border-transparent bg-red-100 text-red-600' },
  pending: { label: 'Pending', className: 'border-transparent bg-amber-100 text-amber-700' },
  refunded: { label: 'Refunded', className: 'border-transparent bg-partner-muted text-muted-foreground' },
}

const selectClass =
  'h-9 rounded-md border border-partner-border bg-white px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function formatCad(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export function BookingsClient({
  sessions,
  strictNoRefund = false,
}: {
  sessions: Session[]
  strictNoRefund?: boolean
}) {
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

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

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
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {bookings.length} booking{bookings.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <Button type="button" variant="outline" onClick={handleExportCsv} className="self-start border-primary text-primary hover:bg-partner-tint">
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      {strictNoRefund ? (
        <Alert className="mb-5 border-partner-border bg-partner-canvas">
          <AlertDescription className="text-xs text-muted-foreground">
            Strict cancellation policy is on — paid bookings are non-refundable in the app. Manual refunds are
            disabled here (workshop archive still refunds active bookings).
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={cn(selectClass, 'w-full sm:w-auto')}
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
          className={cn(selectClass, 'w-full min-w-0 sm:w-auto sm:min-w-[12rem]')}
        >
          <option value="all">All workshops</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>

        <Button type="button" variant="outline" size="sm" onClick={fetchBookings} className="h-9 border-partner-border">
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-partner-muted" />
          ))}
        </div>
      ) : !bookings.length ? (
        <Card className="border-partner-border py-0 shadow-none">
          <PartnerEmptyState
            icon={Users}
            title="No bookings found"
            description="Try adjusting your filters."
          />
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden border-partner-border py-0 shadow-none">
          <div className="hidden grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] gap-3 border-b border-partner-border px-5 py-3 text-xs font-medium text-muted-foreground md:grid">
            <span>Attendee</span>
            <span>Workshop</span>
            <span>Date</span>
            <span title="Customer paid total, minus the Stripe processing fee. This is what's deposited to your bank.">
              Payout
            </span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {bookings.map((b) => {
            const effectiveStatus =
              b.refunded_at || (b.status ?? '').toLowerCase() === 'refunded' ? 'refunded' : (b.status ?? '')
            const badge = STATUS_BADGE[effectiveStatus] ?? {
              label: effectiveStatus || '—',
              className: 'border-transparent bg-partner-muted text-muted-foreground',
            }
            const canRefund = effectiveStatus === 'confirmed' && !b.refunded_at && !strictNoRefund
            const stripeFee = Number(b.stripe_fee_cad ?? 0)
            const amountPaid = b.amount_cad != null ? Number(b.amount_cad) : null
            const payoutAmount = b.net_vendor_cad != null ? Number(b.net_vendor_cad) : amountPaid
            return (
              <div
                key={b.id}
                className="grid grid-cols-1 items-center gap-3 border-b border-partner-border/80 px-5 py-3.5 last:border-0 md:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{b.name ?? 'Guest'}</p>
                  <p className="truncate text-xs text-muted-foreground">{b.email ?? ''}</p>
                </div>

                <p className="truncate text-sm text-muted-foreground">{b.events?.title ?? '—'}</p>

                <p className="text-sm text-muted-foreground">
                  {new Date(b.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                </p>

                <div>
                  <p
                    className="text-sm font-semibold text-foreground"
                    title={
                      amountPaid != null && b.stripe_fee_cad != null
                        ? effectiveStatus === 'refunded'
                          ? `Refunded ${formatCad(amountPaid)} to the client. Stripe fee ${formatCad(stripeFee)} is non-refundable by Stripe and remains the vendor's responsibility per policy.`
                          : `Customer paid ${formatCad(amountPaid)} (incl. tax). Stripe fee ${formatCad(stripeFee)} deducted per policy.`
                        : undefined
                    }
                  >
                    {payoutAmount != null ? formatCad(payoutAmount) : '—'}
                  </p>
                  {effectiveStatus === 'refunded' && amountPaid != null ? (
                    <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                      {formatCad(amountPaid)} refunded ·{' '}
                      {stripeFee > 0
                        ? `${formatCad(stripeFee)} Stripe fee absorbed per policy`
                        : 'Stripe fee handled per policy'}
                    </p>
                  ) : amountPaid != null && stripeFee > 0 ? (
                    <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                      {formatCad(amountPaid)} paid · -{formatCad(stripeFee)} fee
                    </p>
                  ) : null}
                </div>

                <Badge variant="outline" className={cn('w-fit', badge.className)}>
                  {badge.label}
                </Badge>

                <div>
                  {canRefund ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRefund(b.id, b.name ?? 'Guest')}
                      disabled={refundingId === b.id}
                      className="h-8 border-red-200 text-xs text-red-600 hover:bg-red-50"
                    >
                      <RotateCcw className="size-3" />
                      {refundingId === b.id ? 'Processing…' : 'Refund'}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </div>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
