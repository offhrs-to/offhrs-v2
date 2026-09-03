'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Pencil, Plus, Store, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PartnerEmptyState } from '../components/PartnerEmptyState'
import { OrdersPanel } from './OrdersPanel'
import { ProductForm, type ShopProductFormValues } from './ProductForm'
import { ShippingSettingsPanel } from './ShippingSettingsPanel'
import { cn } from '@/lib/utils'

type ShopProduct = ShopProductFormValues & {
  id: string
  created_at?: string
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  published: { label: 'Published', className: 'border-transparent bg-green-100 text-green-700' },
  draft: { label: 'Draft', className: 'border-transparent bg-partner-muted text-muted-foreground' },
  archived: { label: 'Archived', className: 'border-transparent bg-red-50 text-red-400' },
}

function productStatusBadge(product: ShopProduct) {
  if (product.quantity < 1 && product.status === 'archived') {
    return { label: 'Sold out', className: 'border-transparent bg-amber-100 text-amber-800' }
  }
  return STATUS_BADGE[product.status] ?? STATUS_BADGE.draft
}

type BulkAction = 'publish' | 'draft' | 'archive'
type Tab = 'products' | 'orders' | 'shipping'

function tabFromParam(value: string | null): Tab | null {
  if (value === 'products' || value === 'orders' || value === 'shipping') return value
  return null
}

function MarketplacePageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [tab, setTabState] = useState<Tab>(() => tabFromParam(searchParams.get('tab')) ?? 'products')
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ShopProduct | null>(null)
  const [canPublish, setCanPublish] = useState(false)
  const [publishBlockers, setPublishBlockers] = useState<string[]>([])
  const [pickupShopEnabled, setPickupShopEnabled] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkAction, setBulkAction] = useState<BulkAction | ''>('')
  const [bulkApplying, setBulkApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setTab = useCallback(
    (next: Tab) => {
      setTabState(next)
      router.replace(`/partners/dashboard/marketplace?tab=${next}`, { scroll: false })
    },
    [router]
  )

  useEffect(() => {
    const fromUrl = tabFromParam(searchParams.get('tab'))
    if (fromUrl) setTabState(fromUrl)
  }, [searchParams])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url =
        statusFilter !== 'all'
          ? `/api/partners/shop-products?status=${statusFilter}`
          : '/api/partners/shop-products'
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load products')
      setProducts(data.products ?? [])
      setCanPublish(Boolean(data.can_publish))
      setPublishBlockers(data.publish_blockers ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  const fetchShippingMeta = useCallback(async () => {
    try {
      const res = await fetch('/api/partners/marketplace/shipping')
      const data = await res.json()
      if (!res.ok) return
      setPickupShopEnabled(Boolean(data.settings?.shop_pickup_enabled))
      setCanPublish(Boolean(data.can_publish))
      setPublishBlockers(data.publish_blockers ?? [])
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    void fetchShippingMeta()
  }, [fetchShippingMeta])

  useEffect(() => {
    setSelectedIds(new Set())
    setBulkAction('')
  }, [statusFilter])

  async function applyBulk() {
    if (!bulkAction || selectedIds.size === 0) return
    setBulkApplying(true)
    setError(null)
    try {
      const res = await fetch('/api/partners/shop-products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds], action: bulkAction }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bulk action failed')
      setSelectedIds(new Set())
      setBulkAction('')
      await fetchProducts()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk action failed')
    } finally {
      setBulkApplying(false)
    }
  }

  async function archiveOne(id: string) {
    if (!confirm('Archive this product?')) return
    const res = await fetch(`/api/partners/shop-products/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Archive failed')
      return
    }
    await fetchProducts()
  }

  if (showForm) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <ProductForm
          initial={editing}
          canPublish={canPublish}
          pickupShopEnabled={pickupShopEnabled}
          onCancel={() => {
            setShowForm(false)
            setEditing(null)
          }}
          onSaved={() => {
            setShowForm(false)
            setEditing(null)
            void fetchProducts()
          }}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Marketplace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            List physical goods for Canada-only shipping. Platform fee 5% + Stripe on sales.
          </p>
        </div>
        {tab === 'products' ? (
          <Button
            type="button"
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
          >
            <Plus className="mr-1.5 size-4" />
            New product
          </Button>
        ) : null}
      </div>

      <div className="flex gap-2 border-b border-partner-border">
        {(['products', 'orders', 'shipping'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'products' ? 'Products' : t === 'orders' ? 'Orders' : 'Shipping settings'}
          </button>
        ))}
      </div>

      {publishBlockers.length > 0 && tab === 'products' ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">Publishing locked until:</p>
          <ul className="mt-1 list-disc pl-5">
            {publishBlockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-2 text-primary underline"
            onClick={() => setTab('shipping')}
          >
            Open shipping settings
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {tab === 'shipping' ? (
        <ShippingSettingsPanel
          onSaved={() => {
            void fetchProducts()
            void fetchShippingMeta()
          }}
        />
      ) : tab === 'orders' ? (
        <OrdersPanel />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] border-partner-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All (active)</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            {selectedIds.size > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                <Select
                  value={bulkAction || undefined}
                  onValueChange={(v) => setBulkAction(v as BulkAction)}
                >
                  <SelectTrigger className="w-[160px] border-partner-border">
                    <SelectValue placeholder="Bulk action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="publish">Publish</SelectItem>
                    <SelectItem value="draft">Move to draft</SelectItem>
                    <SelectItem value="archive">Archive</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  disabled={!bulkAction || bulkApplying}
                  onClick={() => void applyBulk()}
                >
                  {bulkApplying ? 'Applying…' : 'Apply'}
                </Button>
              </div>
            ) : null}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading products…</p>
          ) : products.length === 0 ? (
            <PartnerEmptyState
              icon={Store}
              title="No products yet"
              description="Add your first listing with weight and dimensions so buyers get live Canada Post rates."
              action={
                <Button
                  type="button"
                  onClick={() => {
                    setEditing(null)
                    setShowForm(true)
                  }}
                >
                  <Plus className="size-4" />
                  New product
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {products.map((p) => {
                const badge = productStatusBadge(p)
                const selected = selectedIds.has(p.id)
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-partner-border bg-white p-4"
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(p.id)) next.delete(p.id)
                          else next.add(p.id)
                          return next
                        })
                      }}
                    />
                    {p.image_urls?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_urls[0]}
                        alt=""
                        className="h-14 w-14 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-partner-muted text-xs text-muted-foreground">
                        No img
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{p.title}</p>
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        ${Number(p.price_cad).toFixed(2)} CAD · qty {p.quantity} · {p.weight_g}g ·{' '}
                        {p.length_cm}×{p.width_cm}×{p.height_cm} cm
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Edit"
                        onClick={() => {
                          setEditing(p)
                          setShowForm(true)
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Archive"
                        onClick={() => void archiveOne(p.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <MarketplacePageInner />
    </Suspense>
  )
}
