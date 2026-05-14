'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Loader2, ImagePlus } from 'lucide-react'
import { CATEGORIES, normalizePartnerSessionCategory } from '@/constants/categories'
import { GooglePlacesField } from '@/app/partners/signup/GooglePlacesField'
import { parseSeriesOccurrences, type EventSeriesFields } from '@/lib/workshop-series'

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

const placesInputClass =
  'w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D] focus:border-transparent disabled:opacity-50'

/** Number of weekly occurrences vendors can choose for a recurring series (API allows 2–12). */
const RECURRING_WEEK_OPTIONS = Array.from({ length: 11 }, (_, i) => i + 2) as readonly number[]

interface SessionFormProps {
  session?: {
    id: string
    title: string
    category: string
    price_cad: number | null
    max_attendees: number | null
    duration_minutes: number | null
    date: string | null
    location: string | null
    status: string
    description?: string | null
    image_url?: string | null
    workshop_series?: string | null
    series_occurrences?: unknown
  } | null
  /** Vendor onboarding address — prefills in-person location for new workshops. */
  vendorDefaultAddress?: string
  /** Default workshop listing image from vendor profile (shown when the workshop has no custom cover). */
  vendorDefaultWorkshopImageUrl?: string
  onClose: () => void
}

export function SessionForm({
  session,
  vendorDefaultAddress = '',
  vendorDefaultWorkshopImageUrl = '',
  onClose,
}: SessionFormProps) {
  const isEdit = !!session?.id

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mapsAuthError, setMapsAuthError] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: session?.title ?? '',
    category: normalizePartnerSessionCategory(session?.category),
    price_cad: session?.price_cad?.toString() ?? '0',
    max_attendees: session?.max_attendees?.toString() ?? '10',
    duration_minutes: session?.duration_minutes?.toString() ?? '90',
    date: session?.date ? new Date(session.date).toISOString().slice(0, 16) : '',
    location_type: 'in_person' as 'in_person' | 'virtual',
    location_address: (session?.location ?? '').trim() || vendorDefaultAddress.trim(),
    location_link: '',
    description: session?.description ?? '',
    status: (session?.status ?? 'published') as 'published' | 'draft',
  })

  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverCleared, setCoverCleared] = useState(false)

  const [recurringWeekly, setRecurringWeekly] = useState(false)
  const [recurringWeekCount, setRecurringWeekCount] = useState(4)
  const [multiWeekMode, setMultiWeekMode] = useState<'same_day_time' | 'custom_times'>('same_day_time')
  const [multiWeekExtraDates, setMultiWeekExtraDates] = useState<string[]>([])

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null)
      return
    }
    const url = URL.createObjectURL(coverFile)
    setCoverPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [coverFile])

  useEffect(() => {
    setCoverFile(null)
    setCoverCleared(false)
  }, [session?.id, isEdit])

  useEffect(() => {
    if (!session?.id) return
    const row: EventSeriesFields = {
      workshop_series: session.workshop_series ?? null,
      series_occurrences: session.series_occurrences,
    }
    const occ = parseSeriesOccurrences(row)
    if (occ.length > 1) {
      setRecurringWeekly(true)
      setRecurringWeekCount(occ.length)
      let weekly = true
      for (let i = 1; i < occ.length; i++) {
        const days =
          (new Date(occ[i].start).getTime() - new Date(occ[i - 1].start).getTime()) / (24 * 60 * 60 * 1000)
        if (Math.abs(days - 7) > 0.35) {
          weekly = false
          break
        }
      }
      if (weekly) {
        setMultiWeekMode('same_day_time')
        setMultiWeekExtraDates([])
      } else {
        setMultiWeekMode('custom_times')
        setMultiWeekExtraDates(occ.slice(1).map((o) => new Date(o.start).toISOString().slice(0, 16)))
      }
    } else {
      setRecurringWeekly(false)
      setRecurringWeekCount(4)
      setMultiWeekMode('same_day_time')
      setMultiWeekExtraDates([])
    }
  }, [session?.id, session?.workshop_series, session?.series_occurrences])

  useEffect(() => {
    if (!recurringWeekly || multiWeekMode !== 'custom_times') return
    const need = Math.max(0, recurringWeekCount - 1)
    setMultiWeekExtraDates((prev) => {
      if (prev.length === need) return prev
      const next = prev.slice(0, need)
      while (next.length < need) next.push('')
      return next
    })
  }, [recurringWeekly, multiWeekMode, recurringWeekCount])

  useEffect(() => {
    if (isEdit) return
    const v = vendorDefaultAddress.trim()
    if (!v) return
    setForm((f) => {
      if (f.location_address.trim()) return f
      return { ...f, location_address: v }
    })
  }, [isEdit, vendorDefaultAddress])

  const handleMapsAuthFailure = useCallback(() => {
    setMapsAuthError(
      'Google Maps could not load for this site. Check API key referrer restrictions and that Maps JavaScript + Places APIs are enabled.'
    )
  }, [])

  const handlePlaceResolved = useCallback(
    (payload: { lat: number; lng: number; formattedAddress: string }) => {
      setForm((f) => ({ ...f, location_address: payload.formattedAddress }))
    },
    []
  )

  const handleClearGeocode = useCallback(() => {
    /* Workshops only persist address text; no lat/lng state to clear. */
  }, [])

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (recurringWeekly) {
        if (!form.date?.trim()) {
          setError('Set the first workshop date & time for a recurring series.')
          setLoading(false)
          return
        }
        if (multiWeekMode === 'custom_times') {
          const need = recurringWeekCount - 1
          if (multiWeekExtraDates.length !== need || multiWeekExtraDates.some((d) => !d.trim())) {
            setError(
              `Enter date & time for all ${recurringWeekCount} workshops (the first is above; add ${need} more below).`
            )
            setLoading(false)
            return
          }
        }
      }

      let cover_image_url: string | null | undefined
      if (coverFile) {
        const fd = new FormData()
        fd.append('file', coverFile)
        const up = await fetch('/api/partners/workshop-images', { method: 'POST', body: fd })
        const uj = (await up.json()) as { url?: string; error?: string }
        if (!up.ok) {
          setError(uj.error ?? 'Image upload failed.')
          setLoading(false)
          return
        }
        if (!uj.url) {
          setError('Image upload failed.')
          setLoading(false)
          return
        }
        cover_image_url = uj.url
      } else if (isEdit && coverCleared) {
        cover_image_url = null
      }

      const payload: Record<string, unknown> = {
        title: form.title,
        category: form.category,
        price_cad: parseFloat(form.price_cad) || 0,
        max_attendees: parseInt(form.max_attendees) || 10,
        duration_minutes: parseInt(form.duration_minutes) || 90,
        date: form.date || undefined,
        location_type: form.location_type,
        location_address: form.location_type === 'in_person' ? form.location_address : undefined,
        location_link: form.location_type === 'virtual' ? form.location_link : undefined,
        description: form.description || undefined,
        status: form.status,
      }
      if (cover_image_url !== undefined) {
        payload.cover_image_url = cover_image_url
      }

      payload.workshop_series = recurringWeekly ? 'multi_week' : 'one_day'
      if (recurringWeekly) {
        payload.multi_week_occurrence_count = recurringWeekCount
        payload.multi_week_schedule = multiWeekMode
        if (multiWeekMode === 'custom_times') {
          payload.multi_week_additional_datetimes = multiWeekExtraDates
        }
      }

      const res = await fetch(
        isEdit ? `/api/partners/sessions/${session!.id}` : '/api/partners/sessions',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to save workshop.')
        setLoading(false)
        return
      }
      onClose()
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-sm text-[#888] hover:text-[#1a1a1a] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to workshops
      </button>

      <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-6">
        {isEdit ? 'Edit workshop' : 'Create a new workshop'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Title <span className="text-red-500">*</span></label>
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            required
            placeholder="e.g. Beginner Pottery Wheel Class"
            className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D] focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            placeholder="What will participants learn or experience?"
            className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D] focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Workshop image</label>
          <p className="text-xs text-[#888] mb-3 leading-relaxed">
            Optional cover photo for this listing. If you don&apos;t add one, your default workshop image from onboarding
            is used when set; otherwise listings use the category artwork.
          </p>
          {vendorDefaultWorkshopImageUrl.trim() && !coverPreview && !(isEdit && session?.image_url && !coverCleared) && (
            <p className="text-xs text-[#5D755D] mb-2">Your default workshop image is on file — it will be used unless you upload a different image below.</p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {(coverPreview || (isEdit && session?.image_url && !coverCleared)) && (
                <div className="relative shrink-0">
                <img
                  src={(coverPreview || session?.image_url) ?? ''}
                  alt=""
                  className="h-28 w-40 rounded-lg border border-[#E8E4DE] object-cover bg-[#FAFAF8]"
                />
              </div>
            )}
            <div className="flex flex-1 flex-col gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#D9D7CF] bg-[#FAFAF8] px-4 py-3 text-sm text-[#555] transition-colors hover:border-[#5D755D]/50">
                <ImagePlus className="h-4 w-4 text-[#5D755D]" />
                <span className="font-medium text-[#1a1a1a]">Choose image</span>
                <span className="text-xs text-[#888]">JPEG, PNG, WebP · max 2 MB</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (!f) return
                    if (f.size > 2 * 1024 * 1024) {
                      setError('Image must be 2 MB or smaller.')
                      return
                    }
                    setError('')
                    setCoverCleared(false)
                    setCoverFile(f)
                  }}
                />
              </label>
              {(coverFile || (isEdit && session?.image_url && !coverCleared)) && (
                <button
                  type="button"
                  onClick={() => {
                    setCoverFile(null)
                    if (isEdit) setCoverCleared(true)
                  }}
                  className="self-start text-xs font-medium text-[#5D755D] hover:underline"
                >
                  {isEdit ? 'Remove custom image (use default workshop image)' : 'Clear selected file'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Category + Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Category <span className="text-red-500">*</span></label>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value as 'published' | 'draft')}
              className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Price + Max attendees + Duration */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Price (CAD) <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888] text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price_cad}
                onChange={(e) => set('price_cad', e.target.value)}
                className="w-full pl-7 pr-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Max spots <span className="text-red-500">*</span></label>
            <input
              type="number"
              min="1"
              value={form.max_attendees}
              onChange={(e) => set('max_attendees', e.target.value)}
              className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Duration (min) <span className="text-red-500">*</span></label>
            <input
              type="number"
              min="15"
              step="15"
              value={form.duration_minutes}
              onChange={(e) => set('duration_minutes', e.target.value)}
              className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Date & time</label>
          <input
            type="datetime-local"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
          />
          <p className="text-xs text-[#888] mt-1">Shown on the public workshop page and in confirmation emails. Leave blank if you coordinate time separately.</p>
        </div>

        <div className="rounded-xl border border-[#E8E4DE] bg-[#FAFAF8] p-4 space-y-4">
            <p className="text-sm font-medium text-[#1a1a1a]">Recurring workshops</p>
            <p className="text-xs text-[#888] leading-relaxed -mt-2">
              By default you create a single listing. Turn on recurring to schedule multiple weekly sessions on one
              workshop card; each session still appears on your connected calendar.
            </p>
            {isEdit && (
              <p className="text-xs text-[#5D755D] font-medium leading-relaxed">
                You can switch a single-date workshop to a weekly series or change week count and follow-up times
                here — save to update this listing.
              </p>
            )}

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-[#C8BFB0] text-[#5D755D] focus:ring-[#5D755D]"
                checked={recurringWeekly}
                onChange={(e) => setRecurringWeekly(e.target.checked)}
              />
              <span>
                <span className="text-sm font-medium text-[#1a1a1a]">Recurring weekly series</span>
                <span className="block text-xs text-[#888] mt-0.5">
                  Repeat this workshop on a weekly rhythm using the date & time above as the first occurrence.
                </span>
              </span>
            </label>

            {recurringWeekly && (
              <div className="space-y-4 pt-3 border-t border-[#E8E4DE]">
                <div>
                  <label htmlFor="recurring-week-count" className="block text-sm font-medium text-[#1a1a1a] mb-1.5">
                    Number of weeks
                  </label>
                  <select
                    id="recurring-week-count"
                    value={recurringWeekCount}
                    onChange={(e) => setRecurringWeekCount(Number(e.target.value))}
                    className="w-full max-w-xs px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
                  >
                    {RECURRING_WEEK_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n} weekly sessions — one workshop listing
                      </option>
                    ))}
                  </select>
                </div>

                <fieldset>
                  <legend className="text-sm font-medium text-[#1a1a1a] mb-2">Date & time for follow-up workshops</legend>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="recurring-week-mode"
                        className="mt-1 h-4 w-4 shrink-0 border-[#C8BFB0] text-[#5D755D] focus:ring-[#5D755D]"
                        checked={multiWeekMode === 'same_day_time'}
                        onChange={() => setMultiWeekMode('same_day_time')}
                      />
                      <span className="text-sm text-[#555] leading-relaxed">
                        Same weekday and time each week — we save one workshop with multiple session dates at the same
                        clock time and duration. Your calendar shows each week when connected.
                      </span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="recurring-week-mode"
                        className="mt-1 h-4 w-4 shrink-0 border-[#C8BFB0] text-[#5D755D] focus:ring-[#5D755D]"
                        checked={multiWeekMode === 'custom_times'}
                        onChange={() => setMultiWeekMode('custom_times')}
                      />
                      <span className="text-sm text-[#555] leading-relaxed">
                        Different date and time for each week — set the first workshop above, then enter each
                        additional occurrence below.
                      </span>
                    </label>
                  </div>
                </fieldset>

                {multiWeekMode === 'custom_times' && (
                  <div className="space-y-3">
                    <p className="text-xs text-[#888] leading-relaxed">
                      Workshop 1 is the date & time at the top of this form. Fill in workshops 2–{recurringWeekCount}.
                    </p>
                    {multiWeekExtraDates.map((val, idx) => (
                      <div key={idx}>
                        <label
                          htmlFor={`recurring-extra-${idx}`}
                          className="block text-xs font-medium text-[#555] mb-1"
                        >
                          Workshop {idx + 2}
                        </label>
                        <input
                          id={`recurring-extra-${idx}`}
                          type="datetime-local"
                          value={val}
                          onChange={(e) => {
                            const next = [...multiWeekExtraDates]
                            next[idx] = e.target.value
                            setMultiWeekExtraDates(next)
                          }}
                          className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D] focus:border-transparent"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Location type <span className="text-red-500">*</span></label>
          <div className="flex gap-3 mb-3">
            {(['in_person', 'virtual'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => set('location_type', type)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  form.location_type === type
                    ? 'border-[#5D755D] bg-[#EDF2ED] text-[#5D755D]'
                    : 'border-[#E8E4DE] bg-white text-[#555] hover:border-[#C8BFB0]'
                }`}
              >
                {type === 'in_person' ? 'In person' : 'Virtual'}
              </button>
            ))}
          </div>
          {form.location_type === 'in_person' ? (
            <div className="space-y-2">
              {MAPS_KEY ? (
                <GooglePlacesField
                  key={isEdit ? `edit-${session!.id}` : 'create-workshop-location'}
                  initialValue={form.location_address}
                  onAddressChange={(address) => setForm((f) => ({ ...f, location_address: address }))}
                  onPlaceResolved={handlePlaceResolved}
                  onClearGeocode={handleClearGeocode}
                  onAuthFailure={handleMapsAuthFailure}
                  apiKey={MAPS_KEY}
                  disabled={loading}
                  label="Address"
                  inputId="workshop-location-address"
                  placeholder="Search for an address or your business name…"
                  inputClassName={placesInputClass}
                />
              ) : (
                <div>
                  <label htmlFor="workshop-location-fallback" className="block text-sm font-medium text-[#1a1a1a] mb-1.5">
                    Address
                  </label>
                  <input
                    id="workshop-location-fallback"
                    value={form.location_address}
                    onChange={(e) => set('location_address', e.target.value)}
                    placeholder="123 Main St, Toronto, ON"
                    className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
                  />
                  <p className="text-xs text-[#888] mt-1.5">
                    Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable address autocomplete.
                  </p>
                </div>
              )}
              {mapsAuthError && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  {mapsAuthError}
                </p>
              )}
            </div>
          ) : (
            <input
              type="url"
              value={form.location_link}
              onChange={(e) => set('location_link', e.target.value)}
              placeholder="https://zoom.us/j/..."
              className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-[#5D755D] text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[#4d644d] disabled:opacity-60 transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit
              ? recurringWeekly
                ? `Save changes (${recurringWeekCount} sessions)`
                : 'Save changes'
              : recurringWeekly
                ? `Create multi-week workshop (${recurringWeekCount} sessions)`
                : 'Create workshop'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-[#888] hover:text-[#1a1a1a] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
