'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PartnerEmptyState } from '../components/PartnerEmptyState'
import { Package } from 'lucide-react'

type ShopOrder = {
  id: string
  product_title: string
  status: string
  fulfillment_type: 'ship' | 'pickup'
  buyer_name: string
  buyer_email: string
  ship_to_line1: string | null
  ship_to_city: string | null
  ship_to_province: string | null
  ship_to_postal_code: string | null
  total_cad: number
  shipping_collected_cad: number
  ship_by_at: string | null
  tracking_number: string | null
  tracking_url: string | null
  shippo_label_url: string | null
  dropoff_receipt_at: string | null
  can_print_label: boolean
  can_mark_pickup: boolean
  can_confirm_dropoff: boolean
  can_refund: boolean
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  paid_awaiting_fulfillment: { label: 'Needs fulfillment', className: 'border-transparent bg-amber-100 text-amber-800' },
  label_purchased: { label: 'Label printed', className: 'border-transparent bg-blue-100 text-blue-800' },
  shipped: { label: 'Shipped', className: 'border-transparent bg-green-100 text-green-700' },
  completed: { label: 'Completed', className: 'border-transparent bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', className: 'border-transparent bg-red-50 text-red-500' },
  refunded: { label: 'Refunded', className: 'border-transparent bg-partner-muted text-muted-foreground' },
  disputed: { label: 'Disputed', className: 'border-transparent bg-red-100 text-red-700' },
}

function formatCad(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function OrdersPanel() {
  const [orders, setOrders] = useState<ShopOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/partners/shop-orders?status=${encodeURIComponent(status)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load orders')
      setOrders(data.orders ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  async function runAction(id: string, path: string, body?: unknown) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/partners/shop-orders/${id}/${path}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action failed')
      if (path === 'label' && data.label_url) {
        window.open(data.label_url as string, '_blank', 'noopener,noreferrer')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="h-9 rounded-md border border-partner-border bg-white px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All orders</option>
          <option value="paid_awaiting_fulfillment">Needs fulfillment</option>
          <option value="label_purchased">Label printed</option>
          <option value="shipped">Shipped</option>
          <option value="completed">Completed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading orders…</p>
      ) : orders.length === 0 ? (
        <PartnerEmptyState
          icon={Package}
          title="No orders yet"
          description="When a buyer purchases one of your listings, it will show up here so you can print a label or mark pickup."
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const badge = STATUS_BADGE[o.status] ?? STATUS_BADGE.paid_awaiting_fulfillment
            const busy = busyId === o.id
            return (
              <li key={o.id} className="rounded-lg border border-partner-border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{o.product_title}</p>
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {o.buyer_name} · {o.buyer_email} · {formatCad(o.total_cad)}
                    </p>
                    {o.fulfillment_type === 'ship' ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Ship to {o.ship_to_line1}
                        {o.ship_to_city ? `, ${o.ship_to_city}` : ''}
                        {o.ship_to_province ? ` ${o.ship_to_province}` : ''}{' '}
                        {o.ship_to_postal_code} · ship by {formatWhen(o.ship_by_at)}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">Local pickup</p>
                    )}
                    {o.dropoff_receipt_at ? (
                      <p className="mt-1 text-sm text-muted-foreground">Drop-off confirmed</p>
                    ) : null}
                    {o.tracking_number ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Tracking {o.tracking_url ? (
                          <a href={o.tracking_url} className="text-primary underline" target="_blank" rel="noreferrer">
                            {o.tracking_number}
                          </a>
                        ) : (
                          o.tracking_number
                        )}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {o.can_print_label ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void runAction(o.id, 'label')}
                      >
                        {o.shippo_label_url ? 'Reprint label' : 'Print label'}
                      </Button>
                    ) : null}
                    {o.shippo_label_url && !o.can_print_label ? (
                      <Button type="button" size="sm" variant="outline" asChild>
                        <a href={o.shippo_label_url} target="_blank" rel="noreferrer">
                          View label
                        </a>
                      </Button>
                    ) : null}
                    {o.can_confirm_dropoff ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void runAction(o.id, 'fulfill', { action: 'dropped_off' })}
                      >
                        Confirm drop-off
                      </Button>
                    ) : null}
                    {o.can_mark_pickup ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void runAction(o.id, 'fulfill', { action: 'picked_up' })}
                      >
                        Mark picked up
                      </Button>
                    ) : null}
                    {o.can_refund ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          if (!confirm('Refund this order? This voids the label if one was purchased (before First Scan only).')) {
                            return
                          }
                          void runAction(o.id, 'refund')
                        }}
                      >
                        Refund
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
