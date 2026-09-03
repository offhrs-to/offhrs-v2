'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { adminFetch } from '@/lib/admin-fetch'
import { Button } from '@/components/ui/button'

type AdminClaim = {
  id: string
  order_id: string
  reason: string
  status: string
  description: string
  seller_response: string | null
  created_at: string
}

type AdminShopOrder = {
  id: string
  product_title: string
  status: string
  fulfillment_type: 'ship' | 'pickup'
  total_cad: number
  shipping_collected_cad?: number
  shippo_rate_amount_cad?: number | null
  shippo_label_cost_cad?: number | null
  tax_cad?: number
  paid_at: string | null
  tracking_number: string | null
  tracking_url: string | null
  shippo_label_url: string | null
  first_scan_at: string | null
  buyer_email: string | null
  apv_clawback_status: string
  apv_adjustment_cad: number
  stripe_dispute_id?: string | null
  stripe_dispute_status?: string | null
  dispute_reason?: string | null
  dispute_amount_cad?: number | null
  dispute_clawback_status?: string
  dispute_clawback_cad?: number
  claims?: AdminClaim[]
  vendor_profiles?: { business_name: string | null } | { business_name: string | null }[] | null
}

function vendorName(order: AdminShopOrder): string {
  const vp = order.vendor_profiles
  const row = Array.isArray(vp) ? vp[0] : vp
  return row?.business_name?.trim() || 'Maker'
}

function formatCad(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

type Action =
  | 'retry_label'
  | 'refund'
  | 'clawback_apv'
  | 'clawback_dispute'
  | 'resolve_claim'
  | 'reject_claim'

export default function AdminShopOrdersPage() {
  const [orders, setOrders] = useState<AdminShopOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sp = new URLSearchParams()
      if (status !== 'all') sp.set('status', status)
      if (filter !== 'all') sp.set('filter', filter)
      const qs = sp.toString() ? `?${sp.toString()}` : ''
      const res = await adminFetch(`/api/admin/shop-orders${qs}`)
      const data = (await res.json()) as { orders?: AdminShopOrder[]; error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to load orders')
      setOrders(data.orders ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [status, filter])

  useEffect(() => {
    void load()
  }, [load])

  async function runAction(
    orderId: string,
    action: Action,
    extra?: { claim_id?: string; admin_notes?: string }
  ) {
    if (action === 'refund' && !confirm('Refund this order? Only allowed before First Scan.')) return
    setBusyId(orderId)
    setError(null)
    try {
      const res = await adminFetch('/api/admin/shop-orders', {
        method: 'POST',
        body: JSON.stringify({ order_id: orderId, action, ...extra }),
      })
      const data = (await res.json()) as { error?: string; label_url?: string }
      if (!res.ok) throw new Error(data.error || 'Action failed')
      if (action === 'retry_label' && data.label_url) {
        window.open(data.label_url, '_blank', 'noopener,noreferrer')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto max-w-5xl px-4 py-10">
        <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-sm text-moss hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Admin dashboard
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Marketplace orders</h1>
        <p className="mt-1 text-sm text-slate-600">
          Labels, refunds, disputes, APV clawbacks, and SNAD claims.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <select
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="paid_awaiting_fulfillment">Needs fulfillment</option>
            <option value="label_purchased">Label printed</option>
            <option value="shipped">Shipped</option>
            <option value="completed">Completed</option>
            <option value="disputed">Disputed</option>
            <option value="refunded">Refunded</option>
          </select>
          <select
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">No special filter</option>
            <option value="disputed">Disputed only</option>
            <option value="apv_pending">APV clawback pending/failed</option>
            <option value="dispute_pending">Dispute clawback pending/failed</option>
          </select>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No orders.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {orders.map((o) => {
              const busy = busyId === o.id
              const canRefund = !o.first_scan_at && !['refunded', 'cancelled', 'completed', 'disputed'].includes(o.status)
              const canLabel = o.fulfillment_type === 'ship' && ['paid_awaiting_fulfillment', 'label_purchased'].includes(o.status)
              return (
                <li key={o.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{o.product_title}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {vendorName(o)} · {formatCad(Number(o.total_cad))} · {o.status.replace(/_/g, ' ')}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {o.buyer_email}
                        {o.tracking_number ? ` · ${o.tracking_number}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Shipping collected {formatCad(Number(o.shipping_collected_cad ?? 0))}
                        {o.shippo_rate_amount_cad != null ? ` · CP quote ${formatCad(Number(o.shippo_rate_amount_cad))}` : ''}
                        {o.shippo_label_cost_cad != null ? ` · label ${formatCad(Number(o.shippo_label_cost_cad))}` : ''}
                        {o.tax_cad != null ? ` · tax ${formatCad(Number(o.tax_cad))}` : ''}
                      </p>
                      {Number(o.apv_adjustment_cad) > 0 ? (
                        <p className="mt-1 text-xs text-amber-800">
                          APV {formatCad(Number(o.apv_adjustment_cad))} ({o.apv_clawback_status})
                        </p>
                      ) : null}
                      {o.stripe_dispute_id ? (
                        <p className="mt-1 text-xs text-red-700">
                          Dispute {o.stripe_dispute_status} · {o.dispute_reason ?? '—'} ·{' '}
                          {formatCad(Number(o.dispute_amount_cad ?? 0))}
                          {o.stripe_dispute_id ? (
                            <>
                              {' '}
                              ·{' '}
                              <a
                                className="underline"
                                href={`https://dashboard.stripe.com/disputes/${o.stripe_dispute_id}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Stripe
                              </a>
                            </>
                          ) : null}
                          {o.dispute_clawback_status && o.dispute_clawback_status !== 'none'
                            ? ` · clawback ${o.dispute_clawback_status} ${formatCad(Number(o.dispute_clawback_cad ?? 0))}`
                            : ''}
                        </p>
                      ) : null}
                      {(o.claims ?? []).map((c) => (
                        <div key={c.id} className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950">
                          Claim {c.reason} · {c.status}: {c.description}
                          {c.seller_response ? <div className="mt-1">Seller: {c.seller_response}</div> : null}
                          {['open', 'seller_responded'].includes(c.status) ? (
                            <div className="mt-1 flex gap-2">
                              <button
                                type="button"
                                className="underline"
                                disabled={busy}
                                onClick={() => void runAction(o.id, 'resolve_claim', { claim_id: c.id })}
                              >
                                Resolve
                              </button>
                              <button
                                type="button"
                                className="underline"
                                disabled={busy}
                                onClick={() => void runAction(o.id, 'reject_claim', { claim_id: c.id })}
                              >
                                Reject
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canLabel ? (
                        <Button type="button" size="sm" disabled={busy} onClick={() => void runAction(o.id, 'retry_label')}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Retry label
                        </Button>
                      ) : null}
                      {o.shippo_label_url ? (
                        <Button type="button" size="sm" variant="outline" asChild>
                          <a href={o.shippo_label_url} target="_blank" rel="noreferrer">
                            Label
                          </a>
                        </Button>
                      ) : null}
                      {canRefund ? (
                        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void runAction(o.id, 'refund')}>
                          Refund
                        </Button>
                      ) : null}
                      {['pending', 'failed'].includes(o.apv_clawback_status) ? (
                        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void runAction(o.id, 'clawback_apv')}>
                          Clawback APV
                        </Button>
                      ) : null}
                      {['pending', 'failed'].includes(o.dispute_clawback_status ?? '') ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void runAction(o.id, 'clawback_dispute')}
                        >
                          Clawback dispute
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
