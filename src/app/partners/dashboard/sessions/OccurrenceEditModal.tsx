'use client'

import { useEffect, useMemo, useState, type WheelEvent } from 'react'
import { Lock, LockOpen, X } from 'lucide-react'
import { GooglePlacesField } from '@/app/partners/signup/GooglePlacesField'
import { formatWorkshopDateTimeLocalValue } from '@/lib/workshop-timezone'
import { spotsFilledLabel } from '@/lib/workshop-spots-label'
import type { SeriesOccurrence } from '@/lib/workshop-series'
import { formatCadMoney, parseCadMoneyInput } from '@/lib/workshop-ticket-price'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

const placesInputClass =
  'w-full px-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-transparent disabled:opacity-50'

function blockNumberInputWheel(e: WheelEvent<HTMLInputElement>) {
  e.currentTarget.blur()
}

export type OccurrenceParentDefaults = {
  title: string
  duration_minutes: number | null
  location: string | null
  price_cad: number | null
  sale_price_cad?: number | null
}

export type OccurrenceEditTarget = {
  sessionId: string
  sessionTitle: string
  occurrence: SeriesOccurrence
  parent: OccurrenceParentDefaults
}

type OccurrenceEditModalProps = {
  target: OccurrenceEditTarget | null
  onClose: () => void
  onSaved: () => void
}

function occurrenceLabel(startIso: string): string {
  const d = new Date(startIso)
  if (Number.isNaN(d.getTime())) return 'Session'
  return d.toLocaleString('en-CA', {
    timeZone: 'America/Toronto',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function moneyEqual(a: number | null | undefined, b: number | null | undefined): boolean {
  const left = a == null ? null : Math.round(Number(a) * 100) / 100
  const right = b == null ? null : Math.round(Number(b) * 100) / 100
  return left === right
}

export function OccurrenceEditModal({ target, onClose, onSaved }: OccurrenceEditModalProps) {
  const [startLocal, setStartLocal] = useState('')
  const [maxAttendees, setMaxAttendees] = useState('')
  const [title, setTitle] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [locationLat, setLocationLat] = useState<number | null>(null)
  const [locationLng, setLocationLng] = useState<number | null>(null)
  const [priceCad, setPriceCad] = useState('')
  const [saleOpen, setSaleOpen] = useState(false)
  const [salePriceCad, setSalePriceCad] = useState('')
  const [loading, setLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [registrationLoading, setRegistrationLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const occ = target?.occurrence
  const filled = useMemo(() => {
    if (!occ) return 0
    const cap = occ.max_attendees ?? 0
    const remaining = occ.available_slots ?? cap
    return Math.max(0, Math.min(cap, cap - remaining))
  }, [occ])

  useEffect(() => {
    if (!target) {
      setStartLocal('')
      setMaxAttendees('')
      setTitle('')
      setDurationMinutes('')
      setLocationAddress('')
      setLocationLat(null)
      setLocationLng(null)
      setPriceCad('')
      setSaleOpen(false)
      setSalePriceCad('')
      setError(null)
      return
    }
    const { occurrence: o, parent } = target
    setStartLocal(formatWorkshopDateTimeLocalValue(o.start))
    setMaxAttendees(String(o.max_attendees ?? 10))
    setTitle((o.title?.trim() || parent.title || '').trim())
    setDurationMinutes(String(o.duration_minutes ?? parent.duration_minutes ?? 90))
    setLocationAddress((o.location?.trim() || parent.location || '').trim())
    setLocationLat(o.location?.trim() ? (o.lat ?? null) : null)
    setLocationLng(o.location?.trim() ? (o.lng ?? null) : null)
    const hasPriceOverride = o.price_cad != null
    const list = hasPriceOverride ? o.price_cad! : (parent.price_cad ?? 0)
    const sale = hasPriceOverride ? (o.sale_price_cad ?? null) : (parent.sale_price_cad ?? null)
    setPriceCad(formatCadMoney(Number(list) || 0))
    setSaleOpen(sale != null && Number(sale) >= 0)
    setSalePriceCad(sale != null ? formatCadMoney(Number(sale)) : '')
    setError(null)
  }, [target?.sessionId, target?.occurrence.start])

  if (!target) return null

  async function handleSave() {
    if (!target) return
    setError(null)

    const parent = target.parent
    const nextTitle = title.trim()
    if (!nextTitle) {
      setError('Title is required.')
      return
    }
    const durationNum = parseInt(durationMinutes, 10)
    if (!Number.isFinite(durationNum) || durationNum < 15 || durationNum > 480) {
      setError('Duration must be between 15 and 480 minutes.')
      return
    }
    const listParsed = parseCadMoneyInput(priceCad)
    if (listParsed == null || listParsed < 0) {
      setError('Enter a valid price (0 for free).')
      return
    }
    let saleParsed: number | null = null
    if (saleOpen && salePriceCad.trim() !== '') {
      saleParsed = parseCadMoneyInput(salePriceCad)
      if (saleParsed == null || saleParsed < 0) {
        setError('Enter a valid sale price.')
        return
      }
      if (!(saleParsed < listParsed)) {
        setError(`Sale price must be below the regular price ($${formatCadMoney(listParsed)}).`)
        return
      }
    }

    const body: Record<string, unknown> = {
      occurrence_start: target.occurrence.start,
    }
    const nextStart = startLocal.trim()
    const origStart = formatWorkshopDateTimeLocalValue(target.occurrence.start)
    if (nextStart && nextStart !== origStart) {
      body.start = nextStart
    }
    const maxNum = parseInt(maxAttendees, 10)
    if (Number.isFinite(maxNum) && maxNum !== target.occurrence.max_attendees) {
      body.max_attendees = maxNum
    }

    const parentTitle = (parent.title || '').trim()
    body.title = nextTitle === parentTitle ? null : nextTitle

    const parentDuration = parent.duration_minutes ?? 90
    body.duration_minutes = durationNum === parentDuration ? null : durationNum

    const parentLocation = (parent.location || '').trim()
    const nextLocation = locationAddress.trim()
    if (nextLocation === parentLocation) {
      body.location = null
      body.location_lat = null
      body.location_lng = null
    } else {
      body.location = nextLocation || null
      body.location_lat = nextLocation ? locationLat : null
      body.location_lng = nextLocation ? locationLng : null
    }

    const parentList = parent.price_cad ?? 0
    const parentSale = parent.sale_price_cad ?? null
    const inheritsPrice = moneyEqual(listParsed, parentList) && moneyEqual(saleParsed, parentSale)
    if (inheritsPrice) {
      body.price_cad = null
      body.sale_price_cad = null
    } else {
      body.price_cad = listParsed
      body.sale_price_cad = saleParsed
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/partners/sessions/${target.sessionId}/occurrences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Could not save session.')
        return
      }
      onSaved()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleRegistration() {
    if (!target || !occ) return
    const closing = !occ.registration_closed
    if (closing) {
      if (
        !confirm(
          'Close registration for this session? It will be hidden from the app. Existing bookings are kept.'
        )
      ) {
        return
      }
    } else if (!confirm('Reopen registration for this session?')) {
      return
    }
    setError(null)
    setRegistrationLoading(true)
    try {
      const res = await fetch(`/api/partners/sessions/${target.sessionId}/occurrences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occurrence_start: target.occurrence.start,
          registration_closed: closing,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Could not update registration.')
        return
      }
      onSaved()
      onClose()
    } finally {
      setRegistrationLoading(false)
    }
  }

  async function handleCancelSession() {
    if (!target) return
    const label = occurrenceLabel(target.occurrence.start)
    if (
      !confirm(
        `Cancel this session?\n\n${label}\n\nIt will be removed from the workshop. This cannot be undone.`
      )
    ) {
      return
    }
    setError(null)
    setCancelLoading(true)
    try {
      const res = await fetch(`/api/partners/sessions/${target.sessionId}/occurrences`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occurrence_start: target.occurrence.start }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Could not cancel session.')
        return
      }
      onSaved()
      onClose()
    } finally {
      setCancelLoading(false)
    }
  }

  const busy = loading || cancelLoading || registrationLoading

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="occurrence-edit-title"
    >
      <div className="flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-partner-border bg-white shadow-none">
        <div className="flex shrink-0 items-center justify-between border-b border-partner-border px-5 py-4">
          <div>
            <h2 id="occurrence-edit-title" className="text-base font-semibold text-foreground">
              Edit session
            </h2>
            <p className="mt-0.5 max-w-[320px] truncate text-xs text-muted-foreground">
              {target.sessionTitle}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-xs text-muted-foreground">
            {spotsFilledLabel(occ?.max_attendees, occ?.available_slots)}
            {filled > 0 ? ' — refund bookings before canceling this session.' : ''}
            {' '}
            Changes here apply to this session only; matching workshop defaults inherit the parent listing.
          </p>

          <div>
            <Label htmlFor="occ-title" className="mb-1">
              Title
            </Label>
            <Input
              id="occ-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="h-10 border-partner-border shadow-none"
            />
          </div>

          <div>
            <Label htmlFor="occ-start" className="mb-1">
              Date &amp; time
            </Label>
            <Input
              id="occ-start"
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              className="h-10 border-partner-border shadow-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="occ-duration" className="mb-1">
                Duration (min)
              </Label>
              <Input
                id="occ-duration"
                type="number"
                min={15}
                max={480}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                onWheel={blockNumberInputWheel}
                className="h-10 border-partner-border shadow-none"
              />
            </div>
            <div>
              <Label htmlFor="occ-max" className="mb-1">
                Max spots
              </Label>
              <Input
                id="occ-max"
                type="number"
                min={1}
                max={500}
                value={maxAttendees}
                onChange={(e) => setMaxAttendees(e.target.value)}
                onWheel={blockNumberInputWheel}
                className="h-10 border-partner-border shadow-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="occ-price" className="mb-1">
                Price (CAD)
              </Label>
              <Input
                id="occ-price"
                type="number"
                min={0}
                step="0.01"
                value={priceCad}
                onChange={(e) => setPriceCad(e.target.value)}
                onBlur={() => {
                  const n = parseCadMoneyInput(priceCad)
                  if (n != null) setPriceCad(formatCadMoney(n))
                }}
                onWheel={blockNumberInputWheel}
                className="h-10 border-partner-border shadow-none"
              />
            </div>
            <div className="flex flex-col justify-end">
              <label className="mb-2 flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={saleOpen}
                  onChange={(e) => {
                    setSaleOpen(e.target.checked)
                    if (!e.target.checked) setSalePriceCad('')
                  }}
                  className="rounded border-partner-border"
                />
                Sale price
              </label>
              {saleOpen ? (
                <Input
                  id="occ-sale"
                  type="number"
                  min={0}
                  step="0.01"
                  value={salePriceCad}
                  onChange={(e) => setSalePriceCad(e.target.value)}
                  onBlur={() => {
                    const n = parseCadMoneyInput(salePriceCad)
                    if (n != null) setSalePriceCad(formatCadMoney(n))
                  }}
                  onWheel={blockNumberInputWheel}
                  placeholder="0.00"
                  className="h-10 border-partner-border shadow-none"
                />
              ) : null}
            </div>
          </div>

          <div>
            <GooglePlacesField
              key={`occ-loc-${target.sessionId}-${target.occurrence.start}`}
              initialValue={locationAddress}
              onAddressChange={(address) => setLocationAddress(address)}
              onPlaceResolved={(payload) => {
                setLocationAddress(payload.formattedAddress)
                setLocationLat(payload.lat)
                setLocationLng(payload.lng)
              }}
              onClearGeocode={() => {
                setLocationLat(null)
                setLocationLng(null)
              }}
              apiKey={MAPS_KEY}
              disabled={busy}
              label="Location"
              inputId="occ-location"
              placeholder="Search for an address…"
              inputClassName={placesInputClass}
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="rounded-xl border border-partner-border bg-partner-canvas p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Registration</p>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              {occ?.registration_closed
                ? 'This session is hidden from the app. Existing bookings are kept.'
                : 'Close registration to hide this session from the app without refunding bookings.'}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleToggleRegistration()}
              disabled={busy}
              className={cn(
                occ?.registration_closed
                  ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-partner-border'
              )}
            >
              {registrationLoading ? (
                'Updating…'
              ) : occ?.registration_closed ? (
                <>
                  <LockOpen className="size-4" />
                  Reopen registration
                </>
              ) : (
                <>
                  <Lock className="size-4" />
                  Close registration
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-partner-border px-5 py-4">
          <Button type="button" onClick={() => void handleSave()} disabled={busy}>
            {loading ? 'Saving…' : 'Save session'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCancelSession()}
            disabled={busy || filled > 0}
            title={
              filled > 0
                ? 'Refund active bookings before canceling this session'
                : 'Remove this session from the series'
            }
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            {cancelLoading ? 'Canceling…' : 'Cancel this session'}
          </Button>
        </div>
      </div>
    </div>
  )
}
