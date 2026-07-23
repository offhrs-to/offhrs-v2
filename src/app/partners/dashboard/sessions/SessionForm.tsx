'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Loader2, ImagePlus } from 'lucide-react'
import { CATEGORIES, normalizePartnerSessionCategory } from '@/constants/categories'
import { GooglePlacesField } from '@/app/partners/signup/GooglePlacesField'
import { parseSeriesOccurrences, type EventSeriesFields } from '@/lib/workshop-series'
import {
  ALL_JS_WEEKDAYS,
  countDailyInstancesInWindow,
  RENEW_INSTANCES_WEEKS,
} from '@/lib/recurring-event-instances'
import { PARTNER_WEEKDAY_TOGGLE_ORDER } from '@/constants/partner-workshop-schedule'
import { formatWorkshopDateTimeLocalValue } from '@/lib/workshop-timezone'
import { WORKSHOP_DESCRIPTION_SECTIONS } from '@/lib/workshop-description-sections'
import { WorkshopRichTextField } from '@/components/WorkshopRichTextField'
import {
  workshopRichTextPlainLength,
  WORKSHOP_RICH_TEXT_MAX_PLAIN_LENGTH,
} from '@/lib/workshop-rich-text'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

const placesInputClass =
  'w-full px-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-transparent disabled:opacity-50'

/** Number of weekly occurrences vendors can choose for a recurring series (API allows 2–12). */
const RECURRING_WEEK_OPTIONS = Array.from({ length: 11 }, (_, i) => i + 2) as readonly number[]

interface SessionFormProps {
  session?: {
    id: string
    title: string
    category: string
    price_cad: number | null
    sale_price_cad?: number | null
    sale_starts_on?: string | null
    sale_ends_on?: string | null
    max_attendees: number | null
    duration_minutes: number | null
    date: string | null
    location: string | null
    lat?: number | null
    lng?: number | null
    status: string
    description?: string | null
    workshop_experience?: string | null
    workshop_experience_hidden?: boolean | null
    workshop_materials_takeaway?: string | null
    workshop_materials_takeaway_hidden?: boolean | null
    workshop_skill_level?: string | null
    workshop_skill_level_hidden?: boolean | null
    image_url?: string | null
    workshop_series?: string | null
    series_occurrences?: unknown
    external_booked_count?: number | null
    partner_series_meta?: { pattern?: string; daily_js_weekdays?: number[]; weeks?: number } | null
  } | null
  /** Vendor onboarding address — prefills in-person location for new workshops. */
  vendorDefaultAddress?: string
  vendorDefaultLat?: number | null
  vendorDefaultLng?: number | null
  /** Default workshop listing image from vendor profile (shown when the workshop has no custom cover). */
  vendorDefaultWorkshopImageUrl?: string
  onClose: () => void
}

export function SessionForm({
  session,
  vendorDefaultAddress = '',
  vendorDefaultLat = null,
  vendorDefaultLng = null,
  vendorDefaultWorkshopImageUrl = '',
  onClose,
}: SessionFormProps) {
  const isEdit = !!session?.id

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mapsAuthError, setMapsAuthError] = useState<string | null>(null)
  const [locationLat, setLocationLat] = useState<number | null>(() =>
    session?.lat != null && Number.isFinite(Number(session.lat)) ? Number(session.lat) : null
  )
  const [locationLng, setLocationLng] = useState<number | null>(() =>
    session?.lng != null && Number.isFinite(Number(session.lng)) ? Number(session.lng) : null
  )

  const initialSeriesOccurrences = parseSeriesOccurrences({
    workshop_series: session?.workshop_series ?? null,
    series_occurrences: session?.series_occurrences,
  })
  const initialSeriesPattern = session?.partner_series_meta?.pattern
  const initialMaxAttendees =
    initialSeriesPattern === 'daily_weekdays' && initialSeriesOccurrences[0]?.max_attendees != null
      ? initialSeriesOccurrences[0].max_attendees
      : session?.max_attendees

  const [form, setForm] = useState({
    title: session?.title ?? '',
    category: normalizePartnerSessionCategory(session?.category),
    price_cad: session?.price_cad?.toString() ?? '0',
    sale_price_cad: session?.sale_price_cad != null ? String(session.sale_price_cad) : '',
    sale_starts_on: session?.sale_starts_on ? String(session.sale_starts_on).slice(0, 10) : '',
    sale_ends_on: session?.sale_ends_on ? String(session.sale_ends_on).slice(0, 10) : '',
    max_attendees: initialMaxAttendees?.toString() ?? '10',
    duration_minutes: session?.duration_minutes?.toString() ?? '90',
    date: session?.date ? formatWorkshopDateTimeLocalValue(session.date) : '',
    location_type: 'in_person' as 'in_person' | 'virtual',
    location_address: (session?.location ?? '').trim() || vendorDefaultAddress.trim(),
    location_link: '',
    description: session?.description ?? '',
    workshop_experience: session?.workshop_experience ?? '',
    workshop_experience_hidden: session?.workshop_experience_hidden ?? false,
    workshop_materials_takeaway: session?.workshop_materials_takeaway ?? '',
    workshop_materials_takeaway_hidden: session?.workshop_materials_takeaway_hidden ?? false,
    workshop_skill_level: session?.workshop_skill_level ?? '',
    workshop_skill_level_hidden: session?.workshop_skill_level_hidden ?? false,
    status: (session?.status ?? 'published') as 'published' | 'draft',
  })

  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverCleared, setCoverCleared] = useState(false)
  const [saleOpen, setSaleOpen] = useState(
    () => session?.sale_price_cad != null && Number(session.sale_price_cad) >= 0
  )

  const [externalBooked, setExternalBooked] = useState(
    String((session as { external_booked_count?: number } | null)?.external_booked_count ?? 0)
  )

  type SeriesPattern = 'single' | 'weekly_same' | 'weekly_custom' | 'daily_weekdays'
  const [seriesPattern, setSeriesPattern] = useState<SeriesPattern>('single')
  const [recurringWeekCount, setRecurringWeekCount] = useState(4)
  const [multiWeekExtraDates, setMultiWeekExtraDates] = useState<string[]>([])
  const [dailyWeekdays, setDailyWeekdays] = useState<Set<number>>(() => new Set(ALL_JS_WEEKDAYS))
  const [dailyWeeks, setDailyWeeks] = useState<number>(RENEW_INSTANCES_WEEKS)

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
    const ext = (session as { external_booked_count?: number }).external_booked_count ?? 0
    setExternalBooked(String(ext))
    const meta = session.partner_series_meta as
      | { pattern?: string; daily_js_weekdays?: number[]; weeks?: number }
      | null
      | undefined
    const row: EventSeriesFields = {
      workshop_series: session.workshop_series ?? null,
      series_occurrences: session.series_occurrences,
    }
    const occ = parseSeriesOccurrences(row)
    if (occ.length > 1) {
      if (meta?.pattern === 'daily_weekdays') {
        setSeriesPattern('daily_weekdays')
        setDailyWeekdays(
          new Set(
            Array.isArray(meta.daily_js_weekdays) && meta.daily_js_weekdays.length > 0
              ? meta.daily_js_weekdays
              : [...ALL_JS_WEEKDAYS]
          )
        )
        setDailyWeeks(
          typeof meta.weeks === 'number' && meta.weeks >= 2 && meta.weeks <= 12
            ? meta.weeks
            : RENEW_INSTANCES_WEEKS
        )
        setRecurringWeekCount(4)
        setMultiWeekExtraDates([])
      } else {
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
          setSeriesPattern('weekly_same')
          setMultiWeekExtraDates([])
        } else {
          setSeriesPattern('weekly_custom')
          setMultiWeekExtraDates(occ.slice(1).map((o) => formatWorkshopDateTimeLocalValue(o.start)))
        }
      }
    } else {
      setSeriesPattern('single')
      setRecurringWeekCount(4)
      setMultiWeekExtraDates([])
      setDailyWeekdays(new Set(ALL_JS_WEEKDAYS))
    }
  }, [session?.id, session?.workshop_series, session?.series_occurrences, session?.partner_series_meta])

  const dailyPreviewCount = useMemo(() => {
    if (seriesPattern !== 'daily_weekdays' || !form.date?.trim()) return null
    const d = new Date(form.date)
    if (Number.isNaN(d.getTime())) return null
    return countDailyInstancesInWindow(d, dailyWeekdays, dailyWeeks * 7)
  }, [seriesPattern, form.date, dailyWeekdays, dailyWeeks])

  const listingSessionCount = useMemo(() => {
    if (seriesPattern === 'single') return 1
    if (seriesPattern === 'daily_weekdays') return dailyPreviewCount ?? 0
    return recurringWeekCount
  }, [seriesPattern, dailyPreviewCount, recurringWeekCount])

  useEffect(() => {
    if (seriesPattern !== 'weekly_custom') return
    const need = Math.max(0, recurringWeekCount - 1)
    setMultiWeekExtraDates((prev) => {
      if (prev.length === need) return prev
      const next = prev.slice(0, need)
      while (next.length < need) next.push('')
      return next
    })
  }, [seriesPattern, recurringWeekCount])

  useEffect(() => {
    if (isEdit) return
    const v = vendorDefaultAddress.trim()
    if (!v) return
    setForm((f) => {
      if (f.location_address.trim()) return f
      return { ...f, location_address: v }
    })
    if (
      vendorDefaultLat != null &&
      vendorDefaultLng != null &&
      Number.isFinite(vendorDefaultLat) &&
      Number.isFinite(vendorDefaultLng)
    ) {
      setLocationLat(vendorDefaultLat)
      setLocationLng(vendorDefaultLng)
    }
  }, [isEdit, vendorDefaultAddress, vendorDefaultLat, vendorDefaultLng])

  const handleMapsAuthFailure = useCallback(() => {
    setMapsAuthError(
      'Google Maps could not load for this site. Check API key referrer restrictions and that Maps JavaScript + Places APIs are enabled.'
    )
  }, [])

  const handlePlaceResolved = useCallback(
    (payload: { lat: number; lng: number; formattedAddress: string }) => {
      setLocationLat(payload.lat)
      setLocationLng(payload.lng)
      setForm((f) => ({ ...f, location_address: payload.formattedAddress }))
    },
    []
  )

  const handleClearGeocode = useCallback(() => {
    setLocationLat(null)
    setLocationLng(null)
  }, [])

  function set(key: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const richFields = [
        form.description,
        form.workshop_experience,
        form.workshop_materials_takeaway,
        form.workshop_skill_level,
      ]
      for (const field of richFields) {
        if (workshopRichTextPlainLength(field) > WORKSHOP_RICH_TEXT_MAX_PLAIN_LENGTH) {
          setError(
            `Each description section must be ${WORKSHOP_RICH_TEXT_MAX_PLAIN_LENGTH} characters or less.`
          )
          setLoading(false)
          return
        }
      }

      const maxSpots = parseInt(form.max_attendees) || 10
      const extElsewhere = Math.max(0, parseInt(externalBooked, 10) || 0)
      if (extElsewhere > maxSpots) {
        setError('Spots booked elsewhere cannot exceed max spots (per session date).')
        setLoading(false)
        return
      }

      if (seriesPattern !== 'single') {
        if (!form.date?.trim()) {
          setError('Set the first workshop date & time for a multi-date listing.')
          setLoading(false)
          return
        }
        if (seriesPattern === 'weekly_custom') {
          const need = recurringWeekCount - 1
          if (multiWeekExtraDates.length !== need || multiWeekExtraDates.some((d) => !d.trim())) {
            setError(
              `Enter date & time for all ${recurringWeekCount} workshops (the first is above; add ${need} more below).`
            )
            setLoading(false)
            return
          }
        }
        if (seriesPattern === 'daily_weekdays' && dailyWeekdays.size === 0) {
          setError('Select at least one day of the week.')
          setLoading(false)
          return
        }
        if (seriesPattern === 'daily_weekdays' && dailyPreviewCount !== null && dailyPreviewCount < 2) {
          setError(
            'Too few sessions in the next few weeks with these weekdays. Add more days or pick a different start date.'
          )
          setLoading(false)
          return
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

      const listPrice = parseFloat(form.price_cad) || 0
      let sale_price_cad: number | null = null
      let sale_starts_on: string | null = null
      let sale_ends_on: string | null = null
      if (saleOpen && form.sale_price_cad.trim() !== '') {
        const sale = parseFloat(form.sale_price_cad)
        if (!Number.isFinite(sale) || sale < 0) {
          setError('Enter a valid sale price.')
          setLoading(false)
          return
        }
        if (listPrice <= 0) {
          setError('Add a regular price before setting a sale price.')
          setLoading(false)
          return
        }
        if (sale >= listPrice) {
          setError('Sale price must be less than the regular price.')
          setLoading(false)
          return
        }
        const start = form.sale_starts_on.trim()
        const end = form.sale_ends_on.trim()
        if (!end) {
          setError('Choose when the sale ends.')
          setLoading(false)
          return
        }
        if (start && start > end) {
          setError('Sale start date must be on or before the end date.')
          setLoading(false)
          return
        }
        sale_price_cad = sale
        sale_starts_on = start || null
        sale_ends_on = end
      }

      const payload: Record<string, unknown> = {
        title: form.title,
        category: form.category,
        price_cad: listPrice,
        sale_price_cad,
        sale_starts_on,
        sale_ends_on,
        max_attendees: maxSpots,
        duration_minutes: parseInt(form.duration_minutes) || 90,
        date: form.date || undefined,
        location_type: form.location_type,
        location_address: form.location_type === 'in_person' ? form.location_address : undefined,
        location_lat: form.location_type === 'in_person' ? locationLat : null,
        location_lng: form.location_type === 'in_person' ? locationLng : null,
        location_link: form.location_type === 'virtual' ? form.location_link : undefined,
        description: form.description || undefined,
        workshop_experience: form.workshop_experience || undefined,
        workshop_experience_hidden: form.workshop_experience_hidden,
        workshop_materials_takeaway: form.workshop_materials_takeaway || undefined,
        workshop_materials_takeaway_hidden: form.workshop_materials_takeaway_hidden,
        workshop_skill_level: form.workshop_skill_level || undefined,
        workshop_skill_level_hidden: form.workshop_skill_level_hidden,
        status: form.status,
        external_booked_count: extElsewhere,
      }
      if (cover_image_url !== undefined) {
        payload.cover_image_url = cover_image_url
      }

      if (seriesPattern === 'single') {
        payload.workshop_series = 'one_day'
      } else {
        payload.workshop_series = 'multi_week'
        if (seriesPattern === 'weekly_same') {
          payload.multi_week_schedule = 'same_day_time'
          payload.multi_week_occurrence_count = recurringWeekCount
        } else if (seriesPattern === 'weekly_custom') {
          payload.multi_week_schedule = 'custom_times'
          payload.multi_week_occurrence_count = recurringWeekCount
          payload.multi_week_additional_datetimes = multiWeekExtraDates
        } else {
          payload.multi_week_schedule = 'daily_weekdays'
          payload.multi_week_daily_js_weekdays = [...dailyWeekdays].sort((a, b) => a - b)
          payload.multi_week_daily_weeks = dailyWeeks
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
    <div className="mx-auto max-w-2xl p-6">
      <Button
        type="button"
        variant="ghost"
        onClick={onClose}
        className="mb-6 h-auto px-0 text-sm text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to workshops
      </Button>

      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">
        {isEdit ? 'Edit workshop' : 'Create a new workshop'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Title <span className="text-red-500">*</span></label>
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            required
            placeholder="e.g. Beginner Pottery Wheel Class"
            className="w-full px-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-transparent"
          />
        </div>

        {/* General description */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">General information</label>
          <WorkshopRichTextField
            value={form.description}
            onChange={(v) => set('description', v)}
            rows={4}
            placeholder="Introduce your workshop — what it's about and who it's for."
          />
        </div>

        {WORKSHOP_DESCRIPTION_SECTIONS.map((section) => {
          const contentKey = section.contentField as keyof typeof form
          const hiddenKey = section.hiddenField as keyof typeof form
          const hidden = Boolean(form[hiddenKey])
          return (
            <div key={section.key} className="rounded-xl border border-partner-border bg-partner-canvas p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <label className="text-sm font-medium text-foreground">{section.title}</label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={hidden}
                    onChange={(e) => set(hiddenKey, e.target.checked)}
                    className="rounded border-partner-border text-primary focus:ring-ring"
                  />
                  Hide section / not applicable
                </label>
              </div>
              <WorkshopRichTextField
                value={String(form[contentKey] ?? '')}
                onChange={(v) => set(contentKey, v)}
                rows={3}
                disabled={hidden}
                placeholder={section.placeholder}
              />
            </div>
          )
        })}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Workshop image</label>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Optional cover photo for this listing. If you don&apos;t add one, your default workshop image from onboarding
            is used when set; otherwise listings use the category artwork.
          </p>
          {vendorDefaultWorkshopImageUrl.trim() && !coverPreview && !(isEdit && session?.image_url && !coverCleared) && (
            <p className="text-xs text-primary mb-2">Your default workshop image is on file — it will be used unless you upload a different image below.</p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {(coverPreview || (isEdit && session?.image_url && !coverCleared)) && (
                <div className="relative shrink-0">
                <img
                  src={(coverPreview || session?.image_url) ?? ''}
                  alt=""
                  className="h-28 w-40 rounded-lg border border-partner-border object-cover bg-partner-canvas"
                />
              </div>
            )}
            <div className="flex flex-1 flex-col gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-partner-border bg-partner-canvas px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50">
                <ImagePlus className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">Choose image</span>
                <span className="text-xs text-muted-foreground">JPEG, PNG, WebP · max 2 MB</span>
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
                  className="self-start text-xs font-medium text-primary hover:underline"
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
            <label className="block text-sm font-medium text-foreground mb-1.5">Category <span className="text-red-500">*</span></label>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="w-full px-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value as 'published' | 'draft')}
              className="w-full px-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Price / max + sale on the left; booked elsewhere / duration on the right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Price (CAD) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price_cad}
                    onChange={(e) => set('price_cad', e.target.value)}
                    className="w-full pl-7 pr-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Max spots <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.max_attendees}
                  onChange={(e) => set('max_attendees', e.target.value)}
                  className="w-full px-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-partner-border bg-white px-3 py-3 hover:border-primary/40 transition-colors">
              <input
                type="checkbox"
                checked={saleOpen}
                onChange={(e) => {
                  const on = e.target.checked
                  setSaleOpen(on)
                  if (!on) {
                    setForm((f) => ({
                      ...f,
                      sale_price_cad: '',
                      sale_starts_on: '',
                      sale_ends_on: '',
                    }))
                  }
                }}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-muted-foreground/40 text-primary focus:ring-ring"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">Offer a discounted price</span>
                <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Show a sale price to customers for a limited time. Must be lower than the regular price.
                </span>
              </span>
            </label>

            {saleOpen ? (
              <div className="rounded-xl border border-partner-border bg-partner-canvas p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Sale price (CAD) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.sale_price_cad}
                      onChange={(e) => set('sale_price_cad', e.target.value)}
                      placeholder="Discounted price"
                      className="w-full pl-7 pr-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Sale starts</label>
                    <input
                      type="date"
                      value={form.sale_starts_on}
                      onChange={(e) => set('sale_starts_on', e.target.value)}
                      className="w-full px-3 py-2 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Sale ends <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required={saleOpen}
                      value={form.sale_ends_on}
                      min={form.sale_starts_on || undefined}
                      onChange={(e) => set('sale_ends_on', e.target.value)}
                      className="w-full px-3 py-2 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Customers pay the sale price on these dates (inclusive). Leave start blank to begin immediately.
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Booked elsewhere</label>
              <input
                type="number"
                min="0"
                value={externalBooked}
                onChange={(e) => setExternalBooked(e.target.value)}
                className="w-full px-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Per session date if you list the same workshop on other platforms (Eventbrite, etc.). Reduces spots
                available on offhrs only.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Duration (min) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="15"
                step="15"
                value={form.duration_minutes}
                onChange={(e) => set('duration_minutes', e.target.value)}
                className="w-full px-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Date & time</label>
          <input
            type="datetime-local"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            className="w-full px-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1">Shown on the public workshop page and in confirmation emails. Leave blank if you coordinate time separately.</p>
        </div>

        <div className="rounded-xl border border-partner-border bg-partner-canvas p-4 space-y-4">
          <p className="text-sm font-medium text-foreground">Schedule &amp; repeating dates</p>
          <p className="text-xs text-muted-foreground leading-relaxed -mt-2">
            One listing can include multiple session times at the same price, location, and duration. Repeats use the
            date &amp; time above as the first occurrence (same clock time for each generated date).
          </p>
          {isEdit && (
            <p className="text-xs text-primary font-medium leading-relaxed">
              You can change how this workshop repeats — save to update dates and availability.
            </p>
          )}

          <fieldset className="space-y-2">
            <legend className="sr-only">Schedule type</legend>
            {(
              [
                ['single', 'Single date', 'One workshop on the date above (or leave date blank).'],
                [
                  'weekly_same',
                  'Weekly — same date & time',
                  'Same group attends every week at the same time. Pick how many weeks — max spots is the cohort size (not per session).',
                ],
                [
                  'weekly_custom',
                  'Weekly — custom dates',
                  'Same group attends each session. Pick a different date and time for each week — max spots is the cohort size.',
                ],
                [
                  'daily_weekdays',
                  'Repeating days',
                  'Same time on selected days over the next several weeks (drop-in style — each session is independent).',
                ],
              ] as const
            ).map(([value, title, help]) => (
              <label key={value} className="flex items-start gap-3 cursor-pointer rounded-lg p-2 hover:bg-white/60">
                <input
                  type="radio"
                  name="series-pattern"
                  className="mt-1 h-4 w-4 shrink-0 border-muted-foreground/40 text-primary focus:ring-ring"
                  checked={seriesPattern === value}
                  onChange={() => setSeriesPattern(value as SeriesPattern)}
                />
                <span>
                  <span className="text-sm font-medium text-foreground">{title}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">{help}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {seriesPattern === 'weekly_same' && (
            <div className="pt-2 border-t border-partner-border space-y-2">
              <label htmlFor="recurring-week-count" className="block text-sm font-medium text-foreground">
                Number of weeks
              </label>
              <select
                id="recurring-week-count"
                value={recurringWeekCount}
                onChange={(e) => setRecurringWeekCount(Number(e.target.value))}
                className="w-full max-w-xs px-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {RECURRING_WEEK_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} sessions — one workshop listing
                  </option>
                ))}
              </select>
            </div>
          )}

          {seriesPattern === 'weekly_custom' && (
            <div className="space-y-4 pt-2 border-t border-partner-border">
              <div>
                <label htmlFor="recurring-week-count-custom" className="block text-sm font-medium text-foreground mb-1.5">
                  Number of sessions
                </label>
                <select
                  id="recurring-week-count-custom"
                  value={recurringWeekCount}
                  onChange={(e) => setRecurringWeekCount(Number(e.target.value))}
                  className="w-full max-w-xs px-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {RECURRING_WEEK_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} workshops — enter each date below
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Workshop 1 is the date &amp; time at the top of this form. Fill in workshops 2–{recurringWeekCount}.
                </p>
                {multiWeekExtraDates.map((val, idx) => (
                  <div key={idx}>
                    <label htmlFor={`recurring-extra-${idx}`} className="block text-xs font-medium text-muted-foreground mb-1">
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
                      className="w-full px-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {seriesPattern === 'daily_weekdays' && (
            <div className="space-y-3 pt-2 border-t border-partner-border">
              <p className="text-xs font-medium text-foreground">Repeat on these days</p>
              <div className="flex flex-wrap gap-2">
                {PARTNER_WEEKDAY_TOGGLE_ORDER.map(({ jsDay, label }) => {
                  const on = dailyWeekdays.has(jsDay)
                  return (
                    <button
                      key={jsDay}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setDailyWeekdays((prev) => {
                          const next = new Set(prev)
                          if (next.has(jsDay)) next.delete(jsDay)
                          else next.add(jsDay)
                          return next
                        })
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors min-w-[2.75rem] border ${
                        on
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-muted-foreground border-partner-border hover:bg-partner-muted'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                All days selected = every calendar day in the window. Tap to exclude — no session on deselected
                days. Same time of day as the first date above.
              </p>
              <div>
                <label htmlFor="daily-weeks" className="block text-sm font-medium text-foreground mb-1.5">
                  Repeat for how many weeks?
                </label>
                <select
                  id="daily-weeks"
                  value={dailyWeeks}
                  onChange={(e) => setDailyWeeks(Number(e.target.value))}
                  className="w-full max-w-xs px-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {RECURRING_WEEK_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} week{n === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </div>
              {dailyPreviewCount != null && (
                <p className="text-xs text-primary font-medium">
                  {dailyPreviewCount} session{dailyPreviewCount === 1 ? '' : 's'} over the next {dailyWeeks}{' '}
                  week{dailyWeeks === 1 ? '' : 's'} (one workshop listing).
                </p>
              )}
            </div>
          )}
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Location type <span className="text-red-500">*</span></label>
          <div className="flex gap-3 mb-3">
            {(['in_person', 'virtual'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => set('location_type', type)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  form.location_type === type
                    ? 'border-primary bg-partner-tint text-primary'
                    : 'border-partner-border bg-white text-muted-foreground hover:border-muted-foreground/30'
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
                  onAddressChange={(address) => {
                    setForm((f) => ({ ...f, location_address: address }))
                  }}
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
                  <label htmlFor="workshop-location-fallback" className="block text-sm font-medium text-foreground mb-1.5">
                    Address
                  </label>
                  <input
                    id="workshop-location-fallback"
                    value={form.location_address}
                    onChange={(e) => {
                      setLocationLat(null)
                      setLocationLng(null)
                      set('location_address', e.target.value)
                    }}
                    placeholder="123 Main St, Toronto, ON"
                    className="w-full px-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
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
              className="w-full px-4 py-2.5 border border-partner-border rounded-xl text-sm text-foreground bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-700">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {isEdit
              ? seriesPattern === 'single'
                ? 'Save changes'
                : `Save changes (${listingSessionCount} session${listingSessionCount === 1 ? '' : 's'})`
              : seriesPattern === 'single'
                ? 'Create workshop'
                : `Create workshop (${listingSessionCount} session${listingSessionCount === 1 ? '' : 's'})`}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} className="text-muted-foreground">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
