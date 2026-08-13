'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { adminFetch } from '@/lib/admin-fetch'
import type { ConnectedShopListItem, ConnectedSyncPreviewResult } from '@/lib/shopify/preview-connected-product'
import type { SyncPreviewResult } from '@/lib/shopify/preview-public-product'

type PreviewMode = 'public' | 'connected'
type AnyPreview = SyncPreviewResult | ConnectedSyncPreviewResult

function isConnectedResult(r: AnyPreview): r is ConnectedSyncPreviewResult {
  return 'deep' in r && r.deep?.mode === 'connected'
}

const VERDICT_STYLES: Record<
  SyncPreviewResult['verdict'],
  { label: string; className: string }
> = {
  ready: {
    label: 'Ready',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  needs_setup: {
    label: 'Needs setup',
    className: 'bg-amber-100 text-amber-900 border-amber-200',
  },
  blocked: {
    label: 'Blocked',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  error: {
    label: 'Error',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
}

export default function ShopifySyncPreviewPage() {
  const [url, setUrl] = useState('')
  const [mode, setMode] = useState<PreviewMode>('public')
  const [shopDomain, setShopDomain] = useState('')
  const [shops, setShops] = useState<ConnectedShopListItem[]>([])
  const [shopsLoading, setShopsLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnyPreview | null>(null)

  const loadShops = useCallback(async () => {
    setShopsLoading(true)
    try {
      const res = await adminFetch('/api/admin/shopify-sync-preview')
      if (!res.ok) return
      const data = (await res.json()) as { shops?: ConnectedShopListItem[] }
      setShops(data.shops ?? [])
    } catch {
      /* ignore */
    } finally {
      setShopsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadShops()
  }, [loadShops])

  async function runPreview(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await adminFetch('/api/admin/shopify-sync-preview', {
        method: 'POST',
        body: JSON.stringify({
          url,
          mode,
          shop_domain: mode === 'connected' && shopDomain ? shopDomain : undefined,
        }),
      })
      const data = (await res.json()) as AnyPreview & { error?: string }
      if (res.status === 401) {
        setError('Not authorized. Open this page while logged into /admin.')
        return
      }
      if (!res.ok) {
        setError(data.error ?? 'Preview failed')
        return
      }
      setResult(data)
    } catch {
      setError('Request failed')
    } finally {
      setLoading(false)
    }
  }

  const deep = result && isConnectedResult(result) ? result.deep : null

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1a1a1a]">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-[#5D755D] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to admin
          </Link>
          <p className="text-xs text-[#888]">Internal · does not write to DB</p>
        </div>

        <header className="space-y-2">
          <h1 className="font-playfair text-3xl font-bold tracking-tight">Shopify Sync preview</h1>
          <p className="text-sm text-[#555] max-w-2xl leading-relaxed">
            Public scan works on any Online Store product URL. Connected deep scan uses the
            partner&apos;s Admin API token (metafields, inventory, billing).
          </p>
        </header>

        <form
          onSubmit={runPreview}
          className="bg-white rounded-xl border border-[#E8E4DE] p-5 shadow-sm space-y-4"
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode('public')}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition-colors ${
                mode === 'public'
                  ? 'bg-[#5D755D] text-white border-[#5D755D]'
                  : 'bg-white text-[#555] border-[#D9D7CF] hover:border-[#5D755D]'
              }`}
            >
              Public URL scan
            </button>
            <button
              type="button"
              onClick={() => setMode('connected')}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition-colors ${
                mode === 'connected'
                  ? 'bg-[#5D755D] text-white border-[#5D755D]'
                  : 'bg-white text-[#555] border-[#D9D7CF] hover:border-[#5D755D]'
              }`}
            >
              Connected shop deep scan
            </button>
          </div>

          {mode === 'connected' && (
            <div className="space-y-1">
              <label htmlFor="shop-domain" className="block text-sm font-medium">
                Connected shop
              </label>
              <select
                id="shop-domain"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                className="w-full rounded-lg border border-[#D9D7CF] bg-[#FAFAF8] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
              >
                <option value="">
                  {shopsLoading
                    ? 'Loading shops…'
                    : shops.length
                      ? 'Auto-match from URL (or pick a shop)'
                      : 'No connected shops yet'}
                </option>
                {shops.map((s) => (
                  <option key={s.shop_domain} value={s.shop_domain}>
                    {(s.business_name || 'Partner') + ' — ' + s.shop_domain}
                    {!s.sync_enabled ? ' (sync off)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[#888]">
                For custom domains (e.g. thedepanneur.ca), pick the partner&apos;s .myshopify.com shop
                if auto-match fails.
              </p>
            </div>
          )}

          <label htmlFor="product-url" className="block text-sm font-medium">
            Product URL
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="product-url"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://shop.example.com/products/…"
              className="flex-1 rounded-lg border border-[#D9D7CF] bg-[#FAFAF8] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#5D755D] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4d634d] disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
                </>
              ) : mode === 'connected' ? (
                'Deep scan'
              ) : (
                'Check feasibility'
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <section className="bg-white rounded-xl border border-[#E8E4DE] p-5 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${VERDICT_STYLES[result.verdict].className}`}
                >
                  {VERDICT_STYLES[result.verdict].label}
                  {deep ? ' · deep scan' : ' · public'}
                </span>
                <a
                  href={result.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[#5D755D] hover:underline"
                >
                  Open product <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="text-sm text-[#333] leading-relaxed">{result.summary}</p>
              <p className="text-xs text-[#888]">
                {result.shopHost} · {result.syncableCount} syncable / {result.skippedCount} skipped ·
                options: {result.product.optionNames.join(', ') || '—'}
                {deep ? ` · ${deep.shopDomain}` : ''}
              </p>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[#888]">
                  Feasibility checks
                </h2>
                <ul className="space-y-3">
                  {result.checks.map((c) => (
                    <li
                      key={c.id}
                      className="bg-white rounded-xl border border-[#E8E4DE] px-4 py-3 flex gap-3"
                    >
                      {c.ok ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="text-xs text-[#555] mt-1 leading-relaxed">{c.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                {result.warnings.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-amber-900">Warnings</h3>
                    {result.warnings.map((w) => (
                      <div
                        key={w}
                        className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 leading-relaxed"
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {result.themeHints && (
                  <div className="rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 space-y-2">
                    <h3 className="text-sm font-semibold">Theme hints (not used by Sync)</h3>
                    <dl className="text-xs text-[#555] space-y-1">
                      {result.themeHints.dateText && (
                        <div>
                          <dt className="inline font-medium text-[#1a1a1a]">Date: </dt>
                          <dd className="inline">{result.themeHints.dateText}</dd>
                        </div>
                      )}
                      {result.themeHints.timeText && (
                        <div>
                          <dt className="inline font-medium text-[#1a1a1a]">Time: </dt>
                          <dd className="inline">{result.themeHints.timeText}</dd>
                        </div>
                      )}
                      {result.themeHints.locationText && (
                        <div>
                          <dt className="inline font-medium text-[#1a1a1a]">Location: </dt>
                          <dd className="inline">{result.themeHints.locationText}</dd>
                        </div>
                      )}
                    </dl>
                    <p className="text-[11px] text-[#888] leading-relaxed">{result.themeHints.note}</p>
                  </div>
                )}

                {deep && (
                  <div className="rounded-xl border border-[#E8E4DE] bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#E8E4DE] space-y-1">
                      <h3 className="text-sm font-semibold">Admin metafields</h3>
                      <p className="text-[11px] text-[#888]">
                        Status {deep.productStatus} · offhrs keys {deep.offhrsMetafields.length} ·
                        total shown {deep.allMetafields.length}
                        {deep.usesOffhrsStartsAt ? ' · using offhrs.starts_at' : ''}
                      </p>
                    </div>
                    {deep.suggestedStartMetafields.length > 0 && (
                      <div className="px-4 py-2 bg-[#EDF2ED] text-[11px] text-[#1a1a1a]">
                        Suggested start fields:{' '}
                        {deep.suggestedStartMetafields
                          .slice(0, 6)
                          .map((m) => `${m.namespace}.${m.key}`)
                          .join(', ')}
                      </div>
                    )}
                    {deep.suggestedLocationMetafields.length > 0 && (
                      <div className="px-4 py-2 bg-[#FAF8F5] text-[11px] text-[#1a1a1a] border-t border-[#E8E4DE]">
                        Suggested location fields:{' '}
                        {deep.suggestedLocationMetafields
                          .slice(0, 6)
                          .map((m) => `${m.namespace}.${m.key}=${m.value.slice(0, 40)}`)
                          .join(' · ')}
                      </div>
                    )}
                    <div className="max-h-56 overflow-auto divide-y divide-[#F0EDE8]">
                      {deep.allMetafields.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-[#888]">No metafields returned.</p>
                      ) : (
                        deep.allMetafields.map((m, i) => (
                          <div
                            key={`${m.scope}-${m.namespace}-${m.key}-${m.variantTitle ?? ''}-${i}`}
                            className="px-4 py-2 text-[11px]"
                          >
                            <p className="font-medium text-[#1a1a1a]">
                              {m.namespace}.{m.key}{' '}
                              <span className="font-normal text-[#888]">
                                ({m.scope}
                                {m.variantTitle ? ` · ${m.variantTitle}` : ''})
                              </span>
                            </p>
                            <p className="text-[#555] break-all line-clamp-2">{m.value}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-[#E8E4DE] bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E8E4DE]">
                    <h3 className="text-sm font-semibold">Variants → sessions</h3>
                  </div>
                  <div className="max-h-80 overflow-auto divide-y divide-[#F0EDE8]">
                    {result.sessions.map((s) => (
                      <div key={s.variantId} className="px-4 py-3 text-xs space-y-1">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium text-[#1a1a1a]">{s.variantTitle}</span>
                          <span
                            className={
                              s.wouldSync ? 'text-green-700 font-medium' : 'text-amber-700'
                            }
                          >
                            {s.wouldSync ? 'Would sync' : 'Skipped'}
                          </span>
                        </div>
                        <p className="text-[#555]">
                          ${s.price}
                          {s.inventoryQuantity != null ? ` · qty ${s.inventoryQuantity}` : ''}
                          {s.start.startsAt
                            ? ` · ${new Date(s.start.startsAt).toLocaleString('en-CA', {
                                timeZone: 'America/Toronto',
                              })} (${s.start.source})`
                            : ' · no start'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[#888]">
                  Demo card (approx.)
                </h2>
                <div className="rounded-2xl overflow-hidden border border-[#E8E4DE] bg-white shadow-sm max-w-md">
                  <div className="aspect-[4/3] bg-[#F0EDE8] relative">
                    {result.demo.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.demo.imageUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-[#999]">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-[#5D755D] font-semibold">
                        {result.demo.organizer ?? 'Partner'}
                      </p>
                      <h3 className="font-playfair text-xl font-bold leading-snug mt-0.5">
                        {result.demo.title}
                      </h3>
                    </div>
                    {result.demo.sessionTimes.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {result.demo.sessionTimes.slice(0, 6).map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-[#EDF2ED] px-2.5 py-1 text-[11px] font-medium text-[#5D755D]"
                          >
                            {t}
                          </span>
                        ))}
                        {result.demo.sessionTimes.length > 6 && (
                          <span className="text-[11px] text-[#888]">
                            +{result.demo.sessionTimes.length - 6} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        No session times Sync can parse yet — card would not appear until start is
                        set.
                      </p>
                    )}
                    <p className="text-xs text-[#555] flex gap-1.5 leading-relaxed">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#5D755D]" />
                      {result.demo.locationNote}
                    </p>
                    {result.demo.description && (
                      <p className="text-xs text-[#555] leading-relaxed line-clamp-4">
                        {result.demo.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <span className="text-sm font-semibold">
                        {result.demo.priceLabel ?? '—'}
                      </span>
                      <a
                        href={result.demo.bookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#5D755D] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#4d634d]"
                      >
                        Book on Shopify
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </div>

                <ul className="text-[11px] text-[#888] space-y-1.5 list-disc pl-4">
                  {result.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
