'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, Users, DollarSign, ShoppingBag, RefreshCw } from 'lucide-react'

interface Metrics {
  statusCounts: Record<string, number>
  activeCount: number
  mrr: number
  churnRate: string
  bookingsMtd: number
  bookingsAllTime: number
  gmv: number
  gmvMtd: number
  vendors: VendorRow[]
}

interface VendorRow {
  id: string
  business_name: string
  slug: string
  status: string
  trial_ends_at: string | null
  subscription_current_period_end: string | null
  stripe_connect_completed: boolean
  first_session_created: boolean
  created_at: string
  bookings: number
  sessions: number
}

const STATUS_COLOURS: Record<string, string> = {
  trialing: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  past_due: 'bg-amber-100 text-amber-700',
  suspended: 'bg-orange-100 text-orange-700',
  canceled: 'bg-red-100 text-red-600',
  pending: 'bg-[#F0EDE8] text-[#888]',
}

function formatCad(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
}

export default function SaasAdminPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/saas-metrics', { credentials: 'include' })
      if (res.status === 401) {
        setError('Not authorized. Open this page while logged into /admin.')
        setLoading(false)
        return
      }
      const data = await res.json()
      setMetrics(data)
    } catch {
      setError('Failed to load metrics.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] p-8">
        <div className="max-w-6xl mx-auto space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/admin" className="text-sm text-[#5D755D] underline">← Back to admin</Link>
        </div>
      </div>
    )
  }

  const m = metrics!
  const kpis = [
    { label: 'MRR', value: formatCad(m.mrr), sub: `${m.statusCounts['active'] ?? 0} active vendors × $79`, icon: TrendingUp, color: 'text-[#5D755D]' },
    { label: 'Active + Trialing', value: String(m.activeCount), sub: `${m.statusCounts['trialing'] ?? 0} trialing, ${m.statusCounts['active'] ?? 0} active`, icon: Users, color: 'text-blue-600' },
    { label: 'Bookings (MTD)', value: String(m.bookingsMtd), sub: `${m.bookingsAllTime} all time`, icon: ShoppingBag, color: 'text-amber-600' },
    { label: 'GMV (MTD)', value: formatCad(m.gmvMtd), sub: `${formatCad(m.gmv)} all time`, icon: DollarSign, color: 'text-purple-600' },
  ]

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="text-[#888] hover:text-[#1a1a1a] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#1a1a1a]">SaaS Metrics</h1>
            <p className="text-sm text-[#888]">Platform KPIs and vendor management</p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 text-sm text-[#888] border border-[#E8E4DE] px-3 py-2 rounded-xl hover:bg-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {kpis.map((k) => (
            <div key={k.label} className="bg-white border border-[#E8E4DE] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <k.icon className={`w-4 h-4 ${k.color}`} />
                <span className="text-xs font-medium text-[#888]">{k.label}</span>
              </div>
              <p className="text-2xl font-bold text-[#1a1a1a]">{k.value}</p>
              <p className="text-xs text-[#888] mt-1">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Status breakdown + churn */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white border border-[#E8E4DE] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#1a1a1a] mb-4">Vendors by status</h2>
            <div className="space-y-2">
              {['trialing', 'active', 'past_due', 'suspended', 'canceled', 'pending'].map((s) => (
                <div key={s} className="flex items-center justify-between">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[s] ?? 'bg-[#F0EDE8] text-[#888]'}`}>
                    {s}
                  </span>
                  <span className="text-sm font-semibold text-[#1a1a1a]">{m.statusCounts[s] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#E8E4DE] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#1a1a1a] mb-4">Growth & churn</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-[#888]">30-day churn rate</p>
                <p className="text-2xl font-bold text-[#1a1a1a]">{m.churnRate}%</p>
              </div>
              <div>
                <p className="text-xs text-[#888]">Total vendors (all time)</p>
                <p className="text-xl font-semibold text-[#1a1a1a]">
                  {Object.values(m.statusCounts).reduce((a, b) => a + b, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Vendor management table */}
        <div className="bg-white border border-[#E8E4DE] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EDE8]">
            <h2 className="text-sm font-semibold text-[#1a1a1a]">Vendor management</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F0EDE8]">
                  {['Business', 'Status', 'Signed up', 'Trial/Billing ends', 'Connect', 'Sessions', 'Bookings'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-[#888] px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {m.vendors.map((v) => (
                  <tr key={v.id} className="border-b border-[#F5F2EE] last:border-0 hover:bg-[#FAF8F5]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1a1a1a] whitespace-nowrap">{v.business_name}</p>
                      <p className="text-xs text-[#888]">{v.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[v.status] ?? 'bg-[#F0EDE8] text-[#888]'}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#555] whitespace-nowrap">
                      {new Date(v.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#555] whitespace-nowrap">
                      {v.trial_ends_at
                        ? new Date(v.trial_ends_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
                        : v.subscription_current_period_end
                        ? new Date(v.subscription_current_period_end).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">{v.stripe_connect_completed ? '✓' : '✗'}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium">{v.sessions}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium">{v.bookings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
