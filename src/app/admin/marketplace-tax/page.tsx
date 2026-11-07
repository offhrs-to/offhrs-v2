'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Loader2, RefreshCw } from 'lucide-react'
import { adminFetch } from '@/lib/admin-fetch'
import { Button } from '@/components/ui/button'
import { currentTorontoQuarter } from '@/lib/shop/marketplace-tax-report'

type ReportOrder = {
  id: string
  paid_at: string | null
  refunded_at: string | null
  status: string
  product_title: string | null
  vendor_name: string
  item_subtotal_cad: number
  shipping_collected_cad: number
  tax_cad: number
  total_cad: number
  stripe_tax_transaction_id: string | null
  counts_toward_remittance: boolean
}

type ReportPayload = {
  year: number
  quarter: number
  label: string
  timezone: string
  summary: {
    order_count: number
    active_order_count: number
    refunded_order_count: number
    collected_tax_cad: number
    refunded_tax_cad: number
    net_remittable_tax_cad: number
    unknown_remitter_with_tax_count: number
  }
  orders: ReportOrder[]
  note?: string
  error?: string
}

function formatCad(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function downloadCsv(label: string, orders: ReportOrder[]) {
  const header = [
    'paid_at_toronto',
    'status',
    'vendor',
    'product',
    'item_subtotal_cad',
    'shipping_cad',
    'tax_cad',
    'total_cad',
    'counts_toward_remittance',
    'stripe_tax_transaction_id',
    'order_id',
  ]
  const lines = [
    header.join(','),
    ...orders.map((o) =>
      [
        JSON.stringify(formatWhen(o.paid_at)),
        o.status,
        JSON.stringify(o.vendor_name),
        JSON.stringify(o.product_title ?? ''),
        o.item_subtotal_cad.toFixed(2),
        o.shipping_collected_cad.toFixed(2),
        o.tax_cad.toFixed(2),
        o.total_cad.toFixed(2),
        o.counts_toward_remittance ? 'yes' : 'no',
        o.stripe_tax_transaction_id ?? '',
        o.id,
      ].join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `offhrs-platform-marketplace-tax-${label.replace(/\s+/g, '-').toLowerCase()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminMarketplaceTaxPage() {
  const initial = useMemo(() => currentTorontoQuarter(), [])
  const [year, setYear] = useState(initial.year)
  const [quarter, setQuarter] = useState(initial.quarter)
  const [report, setReport] = useState<ReportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminFetch(
        `/api/admin/marketplace-tax-report?year=${year}&quarter=${quarter}`
      )
      const data = (await res.json()) as ReportPayload
      if (!res.ok) {
        setError(data.error ?? 'Failed to load report')
        setReport(null)
        return
      }
      setReport(data)
    } catch {
      setError('Failed to load report')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [year, quarter])

  useEffect(() => {
    void load()
  }, [load])

  const onBackfill = async () => {
    setBackfilling(true)
    setBackfillMsg(null)
    try {
      const res = await adminFetch('/api/admin/marketplace-tax-report', { method: 'POST' })
      const data = (await res.json()) as {
        error?: string
        updated?: number
        scanned?: number
        failures?: number
      }
      if (!res.ok) {
        setBackfillMsg(data.error ?? 'Backfill failed')
        return
      }
      setBackfillMsg(
        `Backfilled ${data.updated ?? 0} of ${data.scanned ?? 0} orders` +
          (data.failures ? ` (${data.failures} failed)` : '')
      )
      await load()
    } catch {
      setBackfillMsg('Backfill failed')
    } finally {
      setBackfilling(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <div className="mx-auto max-w-6xl p-8">
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-sm text-[#004027] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Admin
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Marketplace tax (platform remits)</h1>
        </div>

        <p className="mb-6 max-w-3xl text-sm text-slate-600 leading-relaxed">
          GST/HST collected on Artist Marketplace sales where the seller was{' '}
          <strong>not</strong> GST/HST-registered — offhrs remits. Use the net figure with your CRA
          return; still reconcile to Stripe → Tax on the <strong>platform</strong> account.
        </p>

        <div className="mb-6 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Year</span>
            <input
              type="number"
              className="h-10 w-28 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Quarter</span>
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
            >
              <option value={1}>Q1 (Jan–Mar)</option>
              <option value={2}>Q2 (Apr–Jun)</option>
              <option value={3}>Q3 (Jul–Sep)</option>
              <option value={4}>Q4 (Oct–Dec)</option>
            </select>
          </label>
          <Button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="bg-[#004027] hover:bg-[#002E1C]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Load</span>
          </Button>
          {report ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadCsv(report.label, report.orders)}
              className="border-[#004027] text-[#004027]"
            >
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => void onBackfill()}
            disabled={backfilling}
          >
            {backfilling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Backfill remitter from Stripe
          </Button>
        </div>

        {backfillMsg ? <p className="mb-4 text-sm text-slate-600">{backfillMsg}</p> : null}

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-white" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-white p-6 text-red-700">{error}</div>
        ) : report ? (
          <>
            <div className="mb-2 text-sm font-medium text-slate-700">
              {report.label} · {report.timezone}
            </div>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500">Net remittable</p>
                <p className="mt-2 text-2xl font-bold text-[#004027]">
                  {formatCad(report.summary.net_remittable_tax_cad)}
                </p>
                <p className="mt-1 text-xs text-slate-500">Collected − refunded (this quarter)</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500">Collected</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {formatCad(report.summary.collected_tax_cad)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {report.summary.active_order_count} active orders
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500">Refunded tax</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {formatCad(report.summary.refunded_tax_cad)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {report.summary.refunded_order_count} refunded/cancelled
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500">Unknown remitter</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {report.summary.unknown_remitter_with_tax_count}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Orders with tax but no remitter flag — run backfill
                </p>
              </div>
            </div>

            {report.note ? (
              <p className="mb-4 text-xs text-slate-500 leading-relaxed">{report.note}</p>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Paid</th>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Tax</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No platform-remitted Marketplace tax orders in this quarter.
                      </td>
                    </tr>
                  ) : (
                    report.orders.map((o) => (
                      <tr key={o.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                          {formatWhen(o.paid_at)}
                        </td>
                        <td className="px-4 py-3 text-slate-900">{o.vendor_name}</td>
                        <td className="px-4 py-3 text-slate-700">{o.product_title}</td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              o.counts_toward_remittance
                                ? 'font-medium text-[#004027]'
                                : 'text-slate-500'
                            }
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {formatCad(o.tax_cad)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {formatCad(o.total_cad)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
