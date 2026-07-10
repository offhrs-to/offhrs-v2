'use client'

import { useState, useEffect, useMemo, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle, ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'
import Navbar from '@/components/navbar'
import { Badge } from '@/components/ui/badge'
import { fetchUrlMetadata } from '@/app/actions/fetch-metadata'
import { adminFetch } from '@/lib/admin-fetch'
import { useRequireAdminSession } from '@/lib/use-require-admin-session'
import { geocodeAddress } from '@/lib/geocode'
import { parseWorkshopDateTimeInput } from '@/lib/workshop-timezone'
import {
  buildMaterializedEventRows,
  countDailyInstancesInWindow,
  REPEATING_WEEKS_MAX,
  REPEATING_WEEKS_MIN,
  RENEW_INSTANCES_WEEKS,
} from '@/lib/recurring-event-instances'
import { cn } from '@/lib/utils'
import { CATEGORIES } from '@/constants/categories'
import { AdminPartnerNameSearch } from '@/app/admin/components/AdminPartnerNameSearch'

type Recurrence = 'none' | 'daily' | 'weekly'

const RECURRING_WEEK_OPTIONS = Array.from(
  { length: REPEATING_WEEKS_MAX - REPEATING_WEEKS_MIN + 1 },
  (_, i) => i + REPEATING_WEEKS_MIN
)

const WEEKDAY_TOGGLE_ORDER: { jsDay: number; label: string }[] = [
  { jsDay: 1, label: 'Mon' },
  { jsDay: 2, label: 'Tue' },
  { jsDay: 3, label: 'Wed' },
  { jsDay: 4, label: 'Thu' },
  { jsDay: 5, label: 'Fri' },
  { jsDay: 6, label: 'Sat' },
  { jsDay: 0, label: 'Sun' },
]

interface FormData {
  title: string
  category: string
  price: string
  date: string
  location: string
  organizer: string
  image_url: string
  external_link: string
  lat: string
  lng: string
  is_multiple_dates: boolean
  duration_weeks: number
  duration_minutes: string
  description: string
  recurrence: Recurrence
}

export default function AdminEditPage() {
  const router = useRouter()
  const adminReady = useRequireAdminSession()
  const params = useParams()
  const eventId = params.id as string

  const [formData, setFormData] = useState<FormData>({
    title: '',
    category: '',
    price: '',
    date: '',
    location: '',
    organizer: '',
    image_url: '',
    external_link: '',
    lat: '',
    lng: '',
    is_multiple_dates: false,
    duration_weeks: 1,
    duration_minutes: '',
    description: '',
    recurrence: 'none',
  })
  const [loading, setLoading] = useState(false)
  const [fetchingEvent, setFetchingEvent] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [coordinatesFound, setCoordinatesFound] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [fetchingMetadata, setFetchingMetadata] = useState(false)
  const [metadataSuccess, setMetadataSuccess] = useState(false)
  /** Recurrence as loaded from DB — used to expand legacy daily/weekly rows once without duplicating */
  const [initialRecurrence, setInitialRecurrence] = useState<Recurrence>('none')
  const [dailyWeekdays, setDailyWeekdays] = useState<Set<number>>(() => new Set())
  const [recurringWeeks, setRecurringWeeks] = useState(RENEW_INSTANCES_WEEKS)
  const [vendorProfileId, setVendorProfileId] = useState<string | null>(null)

  const dailyPreviewCount = useMemo(() => {
    if (formData.recurrence !== 'daily' || !formData.date.trim()) return null
    const d = new Date(formData.date)
    if (Number.isNaN(d.getTime())) return null
    return countDailyInstancesInWindow(d, dailyWeekdays, recurringWeeks * 7)
  }, [formData.recurrence, formData.date, dailyWeekdays, recurringWeeks])

  useEffect(() => {
    if (eventId) {
      fetchEventData()
    }
  }, [eventId])

  const fetchEventData = async () => {
    setFetchingEvent(true)
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (error) throw error

      if (data) {
        // Pre-fill form with event data
        // Convert lat/lng to strings for form inputs (they might be numbers from DB)
        const lat = data.lat !== null && data.lat !== undefined 
          ? (typeof data.lat === 'number' ? String(data.lat) : data.lat) 
          : ''
        const lng = data.lng !== null && data.lng !== undefined 
          ? (typeof data.lng === 'number' ? String(data.lng) : data.lng) 
          : ''

        setFormData({
          title: data.title || '',
          category: data.category || '',
          price: data.price || '',
          date: data.date ? formatDateForInput(data.date) : '',
          location: data.location || '',
          organizer: data.organizer || '',
          image_url: data.image_url || '',
          external_link: data.external_link || '',
          lat: lat,
          lng: lng,
          is_multiple_dates: data.is_multiple_dates || false,
          duration_weeks: data.duration_weeks != null ? Math.max(1, Number(data.duration_weeks)) : 1,
          duration_minutes:
            data.duration_minutes != null && Number(data.duration_minutes) > 0
              ? String(Number(data.duration_minutes))
              : '',
          description: data.description || '',
          recurrence: (data.recurrence === 'daily' || data.recurrence === 'weekly' ? data.recurrence : 'none') as Recurrence,
        })
        setInitialRecurrence(
          (data.recurrence === 'daily' || data.recurrence === 'weekly'
            ? data.recurrence
            : 'none') as Recurrence
        )
        setVendorProfileId(
          typeof data.vendor_profile_id === 'string' && data.vendor_profile_id.trim()
            ? data.vendor_profile_id.trim()
            : null
        )

        // Set coordinates found if lat/lng exist
        if (data.lat && data.lng) {
          setCoordinatesFound(true)
        }

        // Set external link as URL input if available
        if (data.external_link) {
          setUrlInput(data.external_link)
        }
      }
    } catch (error: any) {
      console.error('Error fetching event:', error)
      setError(error.message || 'Failed to fetch event data')
    } finally {
      setFetchingEvent(false)
    }
  }

  // Helper function to format date for datetime-local input
  const formatDateForInput = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    } catch {
      return dateString
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'duration_weeks'
          ? parseInt(value, 10) || 1
          : type === 'checkbox'
              ? checked
              : value,
    }))
    // Clear error when user starts typing
    if (error) setError(null)
    // Clear coordinates found badge when location changes
    if (name === 'location') {
      setCoordinatesFound(false)
    }
  }

  const handleFetchMetadata = async () => {
    if (!urlInput.trim()) {
      setError('Please enter a valid URL')
      return
    }

    setFetchingMetadata(true)
    setError(null)
    setMetadataSuccess(false)

    try {
      const metadata = await fetchUrlMetadata(urlInput.trim())

      // Populate form fields with fetched data (only if fields are empty or user wants to override)
      setFormData((prev) => ({
        ...prev,
        title: metadata.title || prev.title,
        image_url: metadata.image || prev.image_url,
        date: metadata.date || prev.date,
        location: metadata.location || prev.location,
        organizer: metadata.organizer || prev.organizer,
        external_link: urlInput.trim(), // Set the URL as external_link
      }))

      setMetadataSuccess(true)
      setTimeout(() => setMetadataSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error fetching metadata:', err)
      setError(err.message || 'Failed to fetch metadata from URL')
    } finally {
      setFetchingMetadata(false)
    }
  }

  const handleLocationBlur = async () => {
    const location = formData.location.trim()
    if (!location) {
      setCoordinatesFound(false)
      setFormData((prev) => ({ ...prev, lat: '', lng: '' }))
      return
    }
    if (location.toLowerCase().includes('online') || location.toLowerCase().includes('virtual')) {
      setCoordinatesFound(false)
      setFormData((prev) => ({ ...prev, lat: '', lng: '' }))
      return
    }
    setGeocoding(true)
    setCoordinatesFound(false)
    try {
      const coords = await geocodeAddress(location)
      if (coords) {
        setFormData((prev) => ({ ...prev, lat: coords.lat, lng: coords.lng }))
        setCoordinatesFound(true)
      } else {
        setFormData((prev) => ({ ...prev, lat: '', lng: '' }))
      }
    } catch (err) {
      console.error('Error geocoding location:', err)
      setCoordinatesFound(false)
      setFormData((prev) => ({ ...prev, lat: '', lng: '' }))
    } finally {
      setGeocoding(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Handle lat/lng - convert to string or number safely; geocode if location set but coords missing
      let lat: string | null = formData.lat !== null && formData.lat !== undefined && formData.lat !== ''
        ? (typeof formData.lat === 'string' ? formData.lat.trim() : String(formData.lat))
        : null
      let lng: string | null = formData.lng !== null && formData.lng !== undefined && formData.lng !== ''
        ? (typeof formData.lng === 'string' ? formData.lng.trim() : String(formData.lng))
        : null
      const location = formData.location.trim()
      if (location && (!lat || !lng) && !location.toLowerCase().includes('online') && !location.toLowerCase().includes('virtual')) {
        const coords = await geocodeAddress(location)
        if (coords) {
          lat = coords.lat
          lng = coords.lng
        }
      }

      // Ensure date is stored as ISO string
      let formattedDate: string | null = null
      if (formData.date) {
        const trimmedDate = formData.date.trim()
        if (trimmedDate) {
          // If it's in datetime-local format (YYYY-MM-DDTHH:mm), convert to ISO
          if (trimmedDate.includes('T') && !trimmedDate.includes('Z') && trimmedDate.length === 16) {
            const date = parseWorkshopDateTimeInput(trimmedDate)
            if (date) {
              formattedDate = date.toISOString()
            } else {
              formattedDate = trimmedDate
            }
          } else {
            formattedDate = trimmedDate
          }
        }
      }

      const durationMinutesRaw = formData.duration_minutes.trim()
      let duration_minutes: number | null = null
      if (durationMinutesRaw) {
        if (!/^\d+$/.test(durationMinutesRaw)) {
          throw new Error('Duration (minutes) must be a whole number')
        }
        duration_minutes = parseInt(durationMinutesRaw, 10)
        if (duration_minutes < 15 || duration_minutes > 480) {
          throw new Error('Duration (minutes) must be between 15 and 480')
        }
      }

      // Prepare data for Supabase (handle empty strings as null)
      const submitData = {
        title: formData.title.trim(),
        category: formData.category.trim() || null,
        price: formData.price.trim() || null,
        date: formattedDate,
        location: formData.location.trim() || null,
        organizer: formData.organizer.trim() || null,
        image_url: formData.image_url.trim() || null,
        external_link: formData.external_link.trim() || null,
        lat: lat || null,
        lng: lng || null,
        is_multiple_dates: formData.is_multiple_dates,
        duration_weeks: Math.max(1, formData.duration_weeks),
        duration_minutes,
        description: formData.description.trim() || null,
        recurrence: formData.recurrence,
        vendor_profile_id: vendorProfileId,
      }

      // Validate required fields
      if (!submitData.title) {
        throw new Error('Title is required')
      }

      const legacyRecurringInDb =
        initialRecurrence === 'daily' || initialRecurrence === 'weekly'
      const shouldMaterializeOnEdit =
        legacyRecurringInDb &&
        (formData.recurrence === 'weekly' || formData.recurrence === 'daily') &&
        formattedDate != null

      if (shouldMaterializeOnEdit && formattedDate) {
        if (formData.recurrence === 'daily' && dailyWeekdays.size === 0) {
          throw new Error('Select at least one day of the week for daily renewal')
        }
        const pattern = formData.recurrence === 'daily' ? 'daily' : 'weekly'
        const materializeOptions =
          formData.recurrence === 'daily'
            ? { dailyWeekdays, weeks: recurringWeeks }
            : { weeks: recurringWeeks }
        const rows = buildMaterializedEventRows(
          {
            ...submitData,
            recurrence: formData.recurrence,
          } as Record<string, unknown>,
          pattern,
          materializeOptions
        )
        if (rows.length === 0) {
          throw new Error('Could not build recurring event dates')
        }
        const patchRes = await adminFetch(`/api/admin/events/${eventId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...submitData,
            date: rows[0].date,
            recurrence: 'none',
          }),
        })
        const patchData = await patchRes.json().catch(() => ({}))
        if (!patchRes.ok) throw new Error(patchData.error || 'Failed to update event')

        const rest = rows.slice(1).map(({ date, recurrence, ...row }) => ({
          ...row,
          date,
          recurrence: 'none' as const,
        }))
        if (rest.length > 0) {
          const insertRes = await adminFetch('/api/admin/events', {
            method: 'POST',
            body: JSON.stringify({ rows: rest }),
          })
          const insertData = await insertRes.json().catch(() => ({}))
          if (!insertRes.ok) throw new Error(insertData.error || 'Failed to add recurring instances')
        }
      } else {
        const res = await adminFetch(`/api/admin/events/${eventId}`, {
          method: 'PATCH',
          body: JSON.stringify(submitData),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to update event')
      }

      // Redirect to dashboard on success
      router.push('/admin')
    } catch (err: any) {
      // Enhanced error logging for debugging
      console.error('Error updating event:', err)
      console.error('Error details (JSON):', JSON.stringify(err, null, 2))
      
      if (err?.message) {
        console.error('Error message:', err.message)
      }
      
      if (err?.details) {
        console.error('Error details:', err.details)
      }
      
      if (err?.hint) {
        console.error('Error hint:', err.hint)
      }
      
      // Set user-friendly error message
      const errorMessage = err?.message || err?.details || err?.hint || 'Failed to update event. Please try again.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!adminReady || fetchingEvent) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="container mx-auto max-w-2xl py-12 px-4">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">{fetchingEvent ? 'Loading event...' : 'Checking admin session...'}</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="container mx-auto max-w-2xl py-12 px-4">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-slate-900">Edit Event</h1>
          <p className="text-slate-600 mt-2">Update event details</p>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-900 font-semibold">Error: {error}</p>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>
              Update the event details. Fields marked with * are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Auto-Fill URL Field */}
              <div className="space-y-2 pb-4 border-b border-gray-200">
                <Label htmlFor="event_url">Paste Event URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="event_url"
                    type="url"
                    placeholder="https://www.eventbrite.com/e/..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleFetchMetadata()
                      }
                    }}
                    disabled={fetchingMetadata || loading}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleFetchMetadata}
                    disabled={fetchingMetadata || loading || !urlInput.trim()}
                    className="gap-2 bg-moss hover:bg-moss-dark text-white"
                  >
                    {fetchingMetadata ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Fetch Info
                      </>
                    )}
                  </Button>
                </div>
                {metadataSuccess && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>Data fetched! Review and edit fields below.</span>
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Enter event title"
                  required
                  disabled={loading}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  disabled={loading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  {formData.category &&
                    !(CATEGORIES as readonly string[]).includes(formData.category) && (
                      <option value={formData.category}>{formData.category} (legacy)</option>
                    )}
                </select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="What will attendees learn or experience?"
                  rows={4}
                  disabled={loading}
                />
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="e.g., Free, $25, $50-100"
                  disabled={loading}
                />
              </div>

              {/* Duration (weeks) — XP */}
              <div className="space-y-2">
                <Label htmlFor="duration_weeks">Duration (weeks)</Label>
                <Input
                  id="duration_weeks"
                  name="duration_weeks"
                  type="number"
                  min={1}
                  value={formData.duration_weeks}
                  onChange={handleChange}
                  disabled={loading}
                />
                <p className="text-xs text-slate-500">Used for XP when attendees confirm (e.g. 8-week workshop = 8 points).</p>
              </div>

              {/* Duration (minutes) — session length */}
              <div className="space-y-2">
                <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                <Input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="text"
                  inputMode="numeric"
                  value={formData.duration_minutes}
                  onChange={handleChange}
                  placeholder="e.g. 120"
                  disabled={loading}
                />
                <p className="text-xs text-slate-500">
                  Optional. Session length in minutes (15–480). Shown in the app quick view and bookings.
                </p>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="date">
                    {formData.is_multiple_dates ? 'Next Upcoming Date (For Sorting)' : 'Date & Time'}
                  </Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="checkbox"
                      id="is_multiple_dates"
                      name="is_multiple_dates"
                      checked={formData.is_multiple_dates}
                      onChange={(e) => setFormData((prev) => ({ ...prev, is_multiple_dates: e.target.checked }))}
                      disabled={loading}
                      className="h-4 w-4 rounded border-gray-300 text-moss focus:ring-moss"
                    />
                    <Label htmlFor="is_multiple_dates" className="text-sm font-normal cursor-pointer">
                      This event has multiple dates
                    </Label>
                    <Button
                      type="button"
                      variant={formData.recurrence === 'weekly' ? 'default' : 'outline'}
                      size="sm"
                      className="ml-2"
                      disabled={loading}
                      onClick={() => setFormData((prev) => ({ ...prev, recurrence: prev.recurrence === 'weekly' ? 'none' : 'weekly' }))}
                    >
                      Renew event every week
                    </Button>
                    <Button
                      type="button"
                      variant={formData.recurrence === 'daily' ? 'default' : 'outline'}
                      size="sm"
                      disabled={loading}
                      onClick={() => setFormData((prev) => ({ ...prev, recurrence: prev.recurrence === 'daily' ? 'none' : 'daily' }))}
                    >
                      Renew event every day
                    </Button>
                  </div>
                </div>
                {(formData.recurrence === 'weekly' || formData.recurrence === 'daily') && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 space-y-2">
                    <Label htmlFor="recurring-weeks">How many weeks?</Label>
                    <select
                      id="recurring-weeks"
                      value={recurringWeeks}
                      onChange={(e) => setRecurringWeeks(Number(e.target.value))}
                      disabled={loading}
                      className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {RECURRING_WEEK_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n} week{n === 1 ? '' : 's'}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">
                      {formData.recurrence === 'weekly'
                        ? `Creates ${recurringWeeks} weekly listing${recurringWeeks === 1 ? '' : 's'} (one per week) at the same time of day.`
                        : `Creates listings on selected weekdays over ${recurringWeeks} week${recurringWeeks === 1 ? '' : 's'}.`}
                    </p>
                  </div>
                )}
                {formData.recurrence === 'daily' && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 space-y-2">
                    <p className="text-xs font-medium text-slate-800">Repeat on these days</p>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_TOGGLE_ORDER.map(({ jsDay, label }) => {
                        const on = dailyWeekdays.has(jsDay)
                        return (
                          <button
                            key={jsDay}
                            type="button"
                            disabled={loading}
                            aria-pressed={on}
                            onClick={() =>
                              setDailyWeekdays((prev) => {
                                const next = new Set(prev)
                                if (next.has(jsDay)) next.delete(jsDay)
                                else next.add(jsDay)
                                return next
                              })
                            }
                            className={cn(
                              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors min-w-[2.75rem]',
                              on
                                ? 'bg-moss text-white shadow-sm'
                                : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100'
                            )}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs text-slate-500">
                      Select the weekdays to include. No listing will be created on unselected days during
                      the {recurringWeeks}-week window.
                    </p>
                  </div>
                )}
                {(formData.recurrence === 'weekly' || formData.recurrence === 'daily') &&
                  (initialRecurrence === 'weekly' || initialRecurrence === 'daily') && (
                    <p className="text-xs text-slate-500">
                      This event is still stored as recurring. Saving will create{' '}
                      {formData.recurrence === 'weekly'
                        ? `${recurringWeeks} weekly listing${recurringWeeks === 1 ? '' : 's'}`
                        : dailyPreviewCount != null
                          ? `${dailyPreviewCount} daily listing${dailyPreviewCount === 1 ? '' : 's'} (over ${recurringWeeks} weeks, selected weekdays)`
                          : `daily listings (${recurringWeeks} weeks)`}{' '}
                      (same time of day) and turn this row into a single dated listing.
                    </p>
                  )}
                {(formData.recurrence === 'weekly' || formData.recurrence === 'daily') &&
                  initialRecurrence === 'none' && (
                    <p className="text-xs text-slate-500">
                      Saving will create{' '}
                      {formData.recurrence === 'weekly'
                        ? `${recurringWeeks} weekly listing${recurringWeeks === 1 ? '' : 's'} (${recurringWeeks} occurrence${recurringWeeks === 1 ? '' : 's'})`
                        : dailyPreviewCount != null
                          ? `${dailyPreviewCount} daily listing${dailyPreviewCount === 1 ? '' : 's'} (over ${recurringWeeks} weeks, selected weekdays only)`
                          : `daily listings (${recurringWeeks} weeks, selected weekdays)`}{' '}
                      at the same time of day, starting from the date above.
                    </p>
                  )}
                <Input
                  id="date"
                  name="date"
                  type="datetime-local"
                  value={formData.date}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <div className="relative">
                  <Input
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    onBlur={handleLocationBlur}
                    placeholder="e.g., San Francisco, CA or Online"
                    disabled={loading || geocoding}
                  />
                  {geocoding && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    </div>
                  )}
                  {coordinatesFound && !geocoding && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Badge variant="secondary" className="bg-moss/10 text-moss border-moss/20">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Coordinates found
                      </Badge>
                    </div>
                  )}
                </div>
                {/* Hidden inputs for lat/lng */}
                <input type="hidden" name="lat" value={formData.lat} />
                <input type="hidden" name="lng" value={formData.lng} />
              </div>

              {/* Vendor / Organizer */}
              <AdminPartnerNameSearch
                organizer={formData.organizer}
                vendorProfileId={vendorProfileId}
                onOrganizerChange={(value) =>
                  setFormData((prev) => ({ ...prev, organizer: value }))
                }
                onVendorProfileIdChange={setVendorProfileId}
                onLocationHint={(address) => {
                  setFormData((prev) => {
                    if (prev.location.trim()) return prev
                    return { ...prev, location: address }
                  })
                }}
                disabled={loading}
              />

              {/* Image URL */}
              <div className="space-y-2">
                <Label htmlFor="image_url">Image URL</Label>
                <Input
                  id="image_url"
                  name="image_url"
                  type="url"
                  value={formData.image_url}
                  onChange={handleChange}
                  placeholder="https://example.com/image.jpg"
                  disabled={loading}
                />
              </div>

              {/* External Link */}
              <div className="space-y-2">
                <Label htmlFor="external_link">External Link</Label>
                <Input
                  id="external_link"
                  name="external_link"
                  type="url"
                  value={formData.external_link}
                  onChange={handleChange}
                  placeholder="https://example.com/event"
                  disabled={loading}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-moss hover:bg-moss-dark text-white"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating Event...
                  </>
                ) : (
                  'Update Event'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
