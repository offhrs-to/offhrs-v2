'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Settings = {
  ship_from_name: string
  ship_from_line1: string
  ship_from_line2: string
  ship_from_city: string
  ship_from_province: string
  ship_from_postal_code: string
  ship_from_phone: string
  shipping_handling_fee_cad: number
  shop_pickup_enabled: boolean
  shop_pickup_line1: string
  shop_pickup_line2: string
  shop_pickup_city: string
  shop_pickup_province: string
  shop_pickup_postal_code: string
  shop_pickup_hours: string
  shop_return_policy: string
  canada_ship_attested: boolean
  shop_status: string
  marketplace_qa_status: string
}

const empty: Settings = {
  ship_from_name: '',
  ship_from_line1: '',
  ship_from_line2: '',
  ship_from_city: '',
  ship_from_province: '',
  ship_from_postal_code: '',
  ship_from_phone: '',
  shipping_handling_fee_cad: 0,
  shop_pickup_enabled: false,
  shop_pickup_line1: '',
  shop_pickup_line2: '',
  shop_pickup_city: '',
  shop_pickup_province: '',
  shop_pickup_postal_code: '',
  shop_pickup_hours: '',
  shop_return_policy: '',
  canada_ship_attested: false,
  shop_status: 'off',
  marketplace_qa_status: 'not_started',
}

export function ShippingSettingsPanel({ onSaved }: { onSaved?: () => void }) {
  const [settings, setSettings] = useState<Settings>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/partners/marketplace/shipping')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setSettings({ ...empty, ...data.settings })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function save() {
    setSaving(true)
    setError(null)
    setOk(false)
    try {
      const res = await fetch('/api/partners/marketplace/shipping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          shop_status:
            settings.shop_status === 'off' || settings.shop_status === 'draft'
              ? 'draft'
              : settings.shop_status,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setOk(true)
      setSettings((s) => ({ ...s, canada_ship_attested: true }))
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading shipping settings…</p>
  }

  const inputClass = 'h-9 rounded-md border border-partner-border bg-white px-3 text-sm'

  return (
    <div className="space-y-4 rounded-lg border border-partner-border bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Shipping settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Canada-only ship-from address used for Shippo rates and prepaid labels. Required before
          publishing.
        </p>
      </div>

      {settings.marketplace_qa_status === 'pending_review' ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Seller review is pending. You can save drafts; publishing unlocks after approval.
        </p>
      ) : null}
      {settings.marketplace_qa_status === 'approved' ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Seller review approved — you can publish listings once ship-from is complete.
        </p>
      ) : null}
      {settings.marketplace_qa_status === 'rejected' ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Seller review was not approved. Contact support before publishing.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Shipping settings saved.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label>Ship-from name</Label>
          <Input
            className={inputClass}
            value={settings.ship_from_name}
            onChange={(e) => setSettings((s) => ({ ...s, ship_from_name: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label>Address line 1</Label>
          <Input
            className={inputClass}
            value={settings.ship_from_line1}
            onChange={(e) => setSettings((s) => ({ ...s, ship_from_line1: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label>Address line 2</Label>
          <Input
            className={inputClass}
            value={settings.ship_from_line2}
            onChange={(e) => setSettings((s) => ({ ...s, ship_from_line2: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>City</Label>
          <Input
            className={inputClass}
            value={settings.ship_from_city}
            onChange={(e) => setSettings((s) => ({ ...s, ship_from_city: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Province</Label>
          <Input
            className={inputClass}
            value={settings.ship_from_province}
            onChange={(e) => setSettings((s) => ({ ...s, ship_from_province: e.target.value }))}
            placeholder="ON"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Postal code</Label>
          <Input
            className={inputClass}
            value={settings.ship_from_postal_code}
            onChange={(e) => setSettings((s) => ({ ...s, ship_from_postal_code: e.target.value }))}
            placeholder="M5V 2T6"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input
            className={inputClass}
            value={settings.ship_from_phone}
            onChange={(e) => setSettings((s) => ({ ...s, ship_from_phone: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Handling fee adder (CAD)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            className={inputClass}
            value={settings.shipping_handling_fee_cad}
            onChange={(e) =>
              setSettings((s) => ({ ...s, shipping_handling_fee_cad: Number(e.target.value) }))
            }
          />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label>Return policy (shown to buyers)</Label>
          <Textarea
            rows={3}
            value={settings.shop_return_policy}
            onChange={(e) => setSettings((s) => ({ ...s, shop_return_policy: e.target.value }))}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.shop_pickup_enabled}
          onChange={(e) => setSettings((s) => ({ ...s, shop_pickup_enabled: e.target.checked }))}
        />
        Offer local pickup (optional)
      </label>

      {settings.shop_pickup_enabled ? (
        <div className="space-y-3 rounded-md border border-partner-border bg-partner-canvas/40 p-4">
          <p className="text-sm font-medium text-foreground">Pickup location & hours</p>
          <p className="text-xs text-muted-foreground">
            Shown to buyers when they choose local pickup at checkout.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Pickup address line 1</Label>
              <Input
                className={inputClass}
                value={settings.shop_pickup_line1}
                onChange={(e) => setSettings((s) => ({ ...s, shop_pickup_line1: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Pickup address line 2</Label>
              <Input
                className={inputClass}
                value={settings.shop_pickup_line2}
                onChange={(e) => setSettings((s) => ({ ...s, shop_pickup_line2: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input
                className={inputClass}
                value={settings.shop_pickup_city}
                onChange={(e) => setSettings((s) => ({ ...s, shop_pickup_city: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Province</Label>
              <Input
                className={inputClass}
                value={settings.shop_pickup_province}
                onChange={(e) => setSettings((s) => ({ ...s, shop_pickup_province: e.target.value }))}
                placeholder="ON"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Postal code</Label>
              <Input
                className={inputClass}
                value={settings.shop_pickup_postal_code}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, shop_pickup_postal_code: e.target.value }))
                }
                placeholder="M5V 2T6"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Pickup hours / availability</Label>
              <Textarea
                rows={2}
                value={settings.shop_pickup_hours}
                onChange={(e) => setSettings((s) => ({ ...s, shop_pickup_hours: e.target.value }))}
                placeholder="e.g. Saturdays 10am–2pm, or by appointment"
              />
            </div>
          </div>
        </div>
      ) : null}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={settings.canada_ship_attested}
          onChange={(e) => setSettings((s) => ({ ...s, canada_ship_attested: e.target.checked }))}
        />
        <span>
          I attest that I ship from Canada, fulfill Canada-only Marketplace orders, and agree to the{' '}
          <a
            href="/terms/marketplace-seller-addendum"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Marketplace Seller Addendum
          </a>
          .
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save shipping settings'}
        </Button>
        <select
          className={inputClass}
          value={settings.shop_status}
          onChange={(e) => setSettings((s) => ({ ...s, shop_status: e.target.value }))}
        >
          <option value="off">Shop off</option>
          <option value="draft">Shop draft</option>
          <option value="live">Shop live</option>
          <option value="paused">Shop paused</option>
        </select>
      </div>
    </div>
  )
}
