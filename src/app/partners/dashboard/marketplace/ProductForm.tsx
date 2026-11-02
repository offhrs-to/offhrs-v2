'use client'

import { useEffect, useState } from 'react'
import { Reorder } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { WorkshopRichTextField } from '@/components/WorkshopRichTextField'
import { SHOP_CATEGORIES, type ShopCategory } from '@/lib/shop/categories'
import { SHOP_DEFAULT_SHIP_BY_BUSINESS_DAYS } from '@/lib/shop/fees'
import {
  workshopRichTextPlainLength,
  WORKSHOP_RICH_TEXT_MAX_PLAIN_LENGTH,
} from '@/lib/workshop-rich-text'

function apiErrorMessage(data: { error?: string; fields?: Record<string, string[] | undefined> }): string {
  if (data.fields) {
    const firstField = Object.values(data.fields)
      .flat()
      .find((m): m is string => typeof m === 'string' && m.length > 0)
    if (firstField) return firstField
  }
  return data.error || 'Save failed'
}

type PickupDetails = {
  line1: string
  line2: string
  city: string
  province: string
  postal_code: string
  hours: string
  arrange_by_contact: boolean
}

const emptyPickup = (): PickupDetails => ({
  line1: '',
  line2: '',
  city: '',
  province: '',
  postal_code: '',
  hours: '',
  arrange_by_contact: false,
})

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
  const [pickup, setPickup] = useState<PickupDetails>(emptyPickup)
  const [pickupLoading, setPickupLoading] = useState(false)
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

  useEffect(() => {
    let cancelled = false
    async function loadPickup() {
      setPickupLoading(true)
      try {
        const res = await fetch('/api/partners/marketplace/shipping')
        const data = await res.json()
        if (!res.ok || cancelled) return
        const s = data.settings ?? {}
        setPickup({
          line1: s.shop_pickup_line1 ?? '',
          line2: s.shop_pickup_line2 ?? '',
          city: s.shop_pickup_city ?? '',
          province: s.shop_pickup_province ?? '',
          postal_code: s.shop_pickup_postal_code ?? '',
          hours: s.shop_pickup_hours ?? '',
          arrange_by_contact: Boolean(s.shop_pickup_arrange_by_contact),
        })
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setPickupLoading(false)
      }
    }
    void loadPickup()
    return () => {
      cancelled = true
    }
  }, [])

  function set<K extends keyof ShopProductFormValues>(key: K, value: ShopProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function setPickupField<K extends keyof PickupDetails>(key: K, value: PickupDetails[K]) {
    setPickup((prev) => ({ ...prev, [key]: value }))
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
    if (workshopRichTextPlainLength(values.description) > WORKSHOP_RICH_TEXT_MAX_PLAIN_LENGTH) {
      setError(`Description must be ${WORKSHOP_RICH_TEXT_MAX_PLAIN_LENGTH} characters or less.`)
      setSaving(false)
      return
    }
    try {
      if (values.pickup_available) {
        const pickupRes = await fetch('/api/partners/marketplace/pickup', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop_pickup_enabled: true,
            shop_pickup_line1: pickup.line1,
            shop_pickup_line2: pickup.line2,
            shop_pickup_city: pickup.city,
            shop_pickup_province: pickup.province,
            shop_pickup_postal_code: pickup.postal_code,
            shop_pickup_hours: pickup.hours,
            shop_pickup_arrange_by_contact: pickup.arrange_by_contact,
          }),
        })
        const pickupData = await pickupRes.json()
        if (!pickupRes.ok) throw new Error(apiErrorMessage(pickupData) || 'Could not save pickup details')
      }

      const payload = {
        title: values.title,
        description: values.description,
        category: values.category,
        price_cad: Number(values.price_cad),
        quantity: Math.max(0, Math.round(Number(values.quantity) || 0)),
        weight_g: Math.max(1, Math.round(Number(values.weight_g) || 1)),
        length_cm: Number(values.length_cm),
        width_cm: Number(values.width_cm),
        height_cm: Number(values.height_cm),
        fragile: values.fragile,
        pickup_available: values.pickup_available,
        made_to_order: values.made_to_order,
        ship_by_business_days: Math.min(
          30,
          Math.max(1, Math.round(Number(values.ship_by_business_days) || SHOP_DEFAULT_SHIP_BY_BUSINESS_DAYS))
        ),
        buyer_remorse_returns: values.buyer_remorse_returns,
        status,
        image_urls: values.image_urls,
      }
      const url = values.id
        ? `/api/partners/shop-products/${values.id}`
        : '/api/partners/shop-products'
      const res = await fetch(url, {
        method: values.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(data))
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function reorderImages(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return
    setValues((prev) => {
      const next = [...prev.image_urls]
      const [moved] = next.splice(from, 1)
      if (!moved) return prev
      next.splice(to, 0, moved)
      return { ...prev, image_urls: next }
    })
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
          <WorkshopRichTextField
            value={values.description}
            onChange={(v) => set('description', v)}
            placeholder="Materials, size notes, care instructions…"
            rows={5}
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
            onChange={(e) => set('pickup_available', e.target.checked)}
          />
          Pickup available
        </label>
      </div>

      {values.pickup_available ? (
        <div className="space-y-3 rounded-md border border-partner-border bg-partner-canvas/40 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Pickup location &amp; timing</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Shared across all pickup products. Buyers see this at checkout
              {!pickupShopEnabled
                ? ' — saving will also turn on local pickup in shipping settings'
                : ''}
              .
            </p>
          </div>
          {pickupLoading ? (
            <p className="text-sm text-muted-foreground">Loading pickup details…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="pickup_line1">Pickup address</Label>
                <Input
                  id="pickup_line1"
                  className={inputClass}
                  value={pickup.line1}
                  onChange={(e) => setPickupField('line1', e.target.value)}
                  placeholder="Street address"
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="pickup_line2">Address line 2 (optional)</Label>
                <Input
                  id="pickup_line2"
                  className={inputClass}
                  value={pickup.line2}
                  onChange={(e) => setPickupField('line2', e.target.value)}
                  placeholder="Unit, suite, studio"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pickup_city">City</Label>
                <Input
                  id="pickup_city"
                  className={inputClass}
                  value={pickup.city}
                  onChange={(e) => setPickupField('city', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pickup_province">Province</Label>
                <Input
                  id="pickup_province"
                  className={inputClass}
                  value={pickup.province}
                  onChange={(e) => setPickupField('province', e.target.value)}
                  placeholder="ON"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pickup_postal">Postal code</Label>
                <Input
                  id="pickup_postal"
                  className={inputClass}
                  value={pickup.postal_code}
                  onChange={(e) => setPickupField('postal_code', e.target.value)}
                  placeholder="M5V 2T6"
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="pickup_hours">Available pickup date / time</Label>
                <Textarea
                  id="pickup_hours"
                  rows={2}
                  value={pickup.hours}
                  onChange={(e) => setPickupField('hours', e.target.value)}
                  placeholder="e.g. Saturdays 10am–2pm, or weekdays after 5pm"
                  disabled={pickup.arrange_by_contact}
                />
              </div>
              <label className="sm:col-span-2 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={pickup.arrange_by_contact}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setPickup((prev) => ({
                      ...prev,
                      arrange_by_contact: checked,
                      // Drop fixed hours so they are not kept/shown when arranging by contact.
                      hours: checked ? '' : prev.hours,
                    }))
                  }}
                />
                <span>
                  Contact seller to arrange pickup (buyers email you from their order history instead of
                  using fixed hours)
                </span>
              </label>
            </div>
          )}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Images (up to 8)</Label>
        {values.image_urls.length > 1 ? (
          <p className="text-xs text-muted-foreground">
            Drag a thumbnail (or use ← →) to set order. The first image is the cover.
          </p>
        ) : null}
        <Reorder.Group
          axis="x"
          values={values.image_urls}
          onReorder={(image_urls) => set('image_urls', image_urls)}
          className="flex flex-wrap gap-2"
        >
          {values.image_urls.map((url, index) => (
            <Reorder.Item
              key={url}
              value={url}
              className="relative h-20 w-20 list-none overflow-hidden rounded-md border border-partner-border bg-white"
              whileDrag={{ scale: 1.06, zIndex: 20, boxShadow: '0 8px 20px rgba(0,0,0,0.18)' }}
              style={{ cursor: values.image_urls.length > 1 ? 'grab' : 'default' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                draggable={false}
                className="pointer-events-none h-full w-full object-cover"
              />
              {index === 0 ? (
                <span className="pointer-events-none absolute bottom-0.5 left-0.5 rounded bg-black/65 px-1 text-[9px] font-medium text-white">
                  Cover
                </span>
              ) : (
                <span className="pointer-events-none absolute bottom-0.5 left-0.5 rounded bg-black/50 px-1 text-[9px] text-white">
                  {index + 1}
                </span>
              )}
              {values.image_urls.length > 1 ? (
                <div className="absolute bottom-0.5 right-0.5 flex gap-0.5">
                  <button
                    type="button"
                    aria-label="Move image earlier"
                    disabled={index === 0}
                    className="rounded bg-black/60 px-1 text-[10px] leading-none text-white disabled:opacity-30"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => reorderImages(index, index - 1)}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label="Move image later"
                    disabled={index === values.image_urls.length - 1}
                    className="rounded bg-black/60 px-1 text-[10px] leading-none text-white disabled:opacity-30"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => reorderImages(index, index + 1)}
                  >
                    →
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                aria-label="Remove image"
                className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 text-[10px] text-white"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() =>
                  set(
                    'image_urls',
                    values.image_urls.filter((_, i) => i !== index)
                  )
                }
              >
                ×
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>
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
