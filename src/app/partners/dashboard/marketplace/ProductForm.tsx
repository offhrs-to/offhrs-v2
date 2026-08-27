'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SHOP_CATEGORIES, type ShopCategory } from '@/lib/shop/categories'
import { SHOP_DEFAULT_SHIP_BY_BUSINESS_DAYS } from '@/lib/shop/fees'

export type ShopProductFormValues = {
  id?: string
  title: string
  description: string
  category: ShopCategory
  price_cad: number
  quantity: number
  weight_g: number
  length_cm: number
  width_cm: number
  height_cm: number
  fragile: boolean
  pickup_available: boolean
  made_to_order: boolean
  ship_by_business_days: number
  buyer_remorse_returns: boolean
  status: 'draft' | 'published' | 'archived'
  image_urls: string[]
}

const emptyValues = (): ShopProductFormValues => ({
  title: '',
  description: '',
  category: 'Pottery',
  price_cad: 0,
  quantity: 1,
  weight_g: 500,
  length_cm: 20,
  width_cm: 15,
  height_cm: 10,
  fragile: false,
  pickup_available: false,
  made_to_order: false,
  ship_by_business_days: SHOP_DEFAULT_SHIP_BY_BUSINESS_DAYS,
  buyer_remorse_returns: false,
  status: 'draft',
  image_urls: [],
})

export function ProductForm({
  initial,
  canPublish,
  pickupShopEnabled,
  onCancel,
  onSaved,
}: {
  initial?: Partial<ShopProductFormValues> | null
  canPublish: boolean
  pickupShopEnabled: boolean
  onCancel: () => void
  onSaved: () => void
}) {
  const [values, setValues] = useState<ShopProductFormValues>(() => ({
    ...emptyValues(),
    ...initial,
    category: (initial?.category as ShopCategory) ?? 'Pottery',
    image_urls: initial?.image_urls ?? [],
  }))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValues({
      ...emptyValues(),
      ...initial,
      category: (initial?.category as ShopCategory) ?? 'Pottery',
      image_urls: initial?.image_urls ?? [],
    })
  }, [initial])

  function set<K extends keyof ShopProductFormValues>(key: K, value: ShopProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function uploadImage(file: File) {
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/partners/shop-product-images', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setValues((prev) => ({
        ...prev,
        image_urls: [...prev.image_urls, data.url as string].slice(0, 8),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function save(statusOverride?: 'draft' | 'published') {
    setSaving(true)
    setError(null)
    const status = statusOverride ?? values.status
    if (status === 'published' && !canPublish) {
      setError('Complete shipping settings and seller review before publishing.')
      setSaving(false)
      return
    }
    try {
      const payload = { ...values, status }
      const url = values.id
        ? `/api/partners/shop-products/${values.id}`
        : '/api/partners/shop-products'
      const res = await fetch(url, {
        method: values.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'h-9 rounded-md border border-partner-border bg-white px-3 text-sm'

  return (
    <div className="space-y-5 rounded-lg border border-partner-border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {values.id ? 'Edit product' : 'New product'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Weight and dimensions power live Canada Post rates at checkout.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onCancel} className="border-partner-border">
          Cancel
        </Button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            className={inputClass}
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            rows={4}
            maxLength={6000}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            className={inputClass + ' w-full'}
            value={values.category}
            onChange={(e) => set('category', e.target.value as ShopCategory)}
          >
            {SHOP_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">Price (CAD)</Label>
          <Input
            id="price"
            type="number"
            min={0}
            step={0.01}
            className={inputClass}
            value={values.price_cad}
            onChange={(e) => set('price_cad', Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qty">Quantity</Label>
          <Input
            id="qty"
            type="number"
            min={0}
            className={inputClass}
            value={values.quantity}
            onChange={(e) => set('quantity', Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="weight">Weight (g)</Label>
          <Input
            id="weight"
            type="number"
            min={1}
            className={inputClass}
            value={values.weight_g}
            onChange={(e) => set('weight_g', Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="length">Length (cm)</Label>
          <Input
            id="length"
            type="number"
            min={0.1}
            step={0.1}
            className={inputClass}
            value={values.length_cm}
            onChange={(e) => set('length_cm', Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="width">Width (cm)</Label>
          <Input
            id="width"
            type="number"
            min={0.1}
            step={0.1}
            className={inputClass}
            value={values.width_cm}
            onChange={(e) => set('width_cm', Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="height">Height (cm)</Label>
          <Input
            id="height"
            type="number"
            min={0.1}
            step={0.1}
            className={inputClass}
            value={values.height_cm}
            onChange={(e) => set('height_cm', Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ship_by">Ship within (business days)</Label>
          <Input
            id="ship_by"
            type="number"
            min={1}
            max={30}
            className={inputClass}
            value={values.ship_by_business_days}
            onChange={(e) => set('ship_by_business_days', Number(e.target.value))}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.fragile}
            onChange={(e) => set('fragile', e.target.checked)}
          />
          Fragile
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.made_to_order}
            onChange={(e) => set('made_to_order', e.target.checked)}
          />
          Made to order
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.buyer_remorse_returns}
            onChange={(e) => set('buyer_remorse_returns', e.target.checked)}
          />
          Allow buyer&apos;s-remorse returns
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.pickup_available}
            disabled={!pickupShopEnabled}
            onChange={(e) => set('pickup_available', e.target.checked)}
          />
          Pickup available{!pickupShopEnabled ? ' (enable in shipping settings)' : ''}
        </label>
      </div>

      <div className="space-y-2">
        <Label>Images (up to 8)</Label>
        <div className="flex flex-wrap gap-2">
          {values.image_urls.map((url) => (
            <div key={url} className="relative h-20 w-20 overflow-hidden rounded-md border border-partner-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 text-[10px] text-white"
                onClick={() =>
                  set(
                    'image_urls',
                    values.image_urls.filter((u) => u !== url)
                  )
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading || values.image_urls.length >= 8}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void uploadImage(f)
            e.target.value = ''
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="button" disabled={saving} onClick={() => void save('draft')}>
          {saving ? 'Saving…' : 'Save draft'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-partner-border"
          disabled={saving || !canPublish}
          onClick={() => void save('published')}
        >
          Publish
        </Button>
      </div>
    </div>
  )
}
