'use client'

import { useState, useMemo, FormEvent } from 'react'
import { insertEvents } from '@/app/actions/events'
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
import { geocodeAddress } from '@/lib/geocode'
import { parseWorkshopDateTimeInput } from '@/lib/workshop-timezone'
import {
  ALL_JS_WEEKDAYS,
  buildMaterializedEventRows,
  countDailyInstancesInWindow,
  REPEATING_WEEKS_MAX,
  REPEATING_WEEKS_MIN,
  RENEW_INSTANCES_WEEKS,
} from '@/lib/recurring-event-instances'
import { cn } from '@/lib/utils'
import { CATEGORIES } from '@/constants/categories'

const RECURRING_WEEK_OPTIONS = Array.from(
  { length: REPEATING_WEEKS_MAX - REPEATING_WEEKS_MIN + 1 },
  (_, i) => i + REPEATING_WEEKS_MIN
)

type Recurrence = 'none' | 'daily' | 'weekly'

/** Mon–Sun order; values match Date#getDay() (0 = Sunday) */
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
  duration_minutes: number
  description: string
  recurrence: Recurrence
}

export default function AdminAddPage() {
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
    duration_minutes: 90,
    description: '',
    recurrence: 'none',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [coordinatesFound, setCoordinatesFound] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [fetchingMetadata, setFetchingMetadata] = useState(false)
  const [metadataSuccess, setMetadataSuccess] = useState(false)
  /** For daily renewal: which weekdays (JS 0–6) get an instance in the selected week window */
  const [dailyWeekdays, setDailyWeekdays] = useState<Set<number>>(() => new Set(ALL_JS_WEEKDAYS))
  /** How many weeks of recurring listings to create (weekly or daily patterns). */
  const [recurringWeeks, setRecurringWeeks] = useState(RENEW_INSTANCES_WEEKS)

  const dailyPreviewCount = useMemo(() => {
    if (formData.recurrence !== 'daily' || !formData.date.trim()) return null
    const d = new Date(formData.date)
    if (Number.isNaN(d.getTime())) return null
    return countDailyInstancesInWindow(d, dailyWeekdays, recurringWeeks * 7)
  }, [formData.recurrence, formData.date, dailyWeekdays, recurringWeeks])

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
          : name === 'duration_minutes'
            ? Math.min(480, Math.max(15, parseInt(value, 10) || 90))
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

      // Populate form fields with fetched data
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
    setSuccess(false)

    try {
      // If location is set but lat/lng are missing, geocode now so we always save coordinates
      let lat = formData.lat.trim()
      let lng = formData.lng.trim()
      const location = formData.location.trim()
      if (location && (!lat || !lng) && !location.toLowerCase().includes('online') && !location.toLowerCase().includes('virtual')) {
        const coords = await geocodeAddress(location)
        if (coords) {
          lat = coords.lat
          lng = coords.lng
        }
      }

      // Prepare data for Supabase (handle empty strings as null)
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

      const submitData = {
        title: formData.title.trim(),
        mode: 'craft', // Always set to 'craft' for leisure workshops
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
        duration_minutes: formData.duration_minutes,
        description: formData.description.trim() || null,
        recurrence: formData.recurrence,
      }

      // Validate required fields
      if (!submitData.title) {
        throw new Error('Title is required')
      }

      const shouldMaterializeRenewal =
        (formData.recurrence === 'weekly' || formData.recurrence === 'daily') &&
        formattedDate != null

      if (shouldMaterializeRenewal && formattedDate) {
        if (formData.recurrence === 'daily' && dailyWeekdays.size === 0) {
          throw new Error('Select at least one day of the week for daily renewal')
        }
        const pattern = formData.recurrence === 'daily' ? 'daily' : 'weekly'
        const materializeOptions =
          formData.recurrence === 'daily'
            ? { dailyWeekdays, weeks: recurringWeeks }
            : { weeks: recurringWeeks }
        const rows = buildMaterializedEventRows(
          { ...submitData, recurrence: formData.recurrence } as Record<string, unknown>,
          pattern,
          materializeOptions
        ) as Array<typeof submitData & { recurrence: Recurrence }>
        if (rows.length === 0) {
          throw new Error('Could not build recurring event dates')
        }
        // One row per occurrence; recurrence is stored as 'none' so the cron job does not
        // advance multiple rows for the same workshop (would create duplicate future slots).
        await insertEvents(rows)
      } else {
        await insertEvents([submitData])
      }

      // Success!
      setSuccess(true)
      // Reset form
      setFormData({
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
        duration_minutes: 90,
        description: '',
        recurrence: 'none',
      })
      setDailyWeekdays(new Set(ALL_JS_WEEKDAYS))
      setRecurringWeeks(RENEW_INSTANCES_WEEKS)
      setUrlInput('')
      setCoordinatesFound(false)
      setMetadataSuccess(false)

      // Hide success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000)
    } catch (err: any) {
      // Enhanced error logging for debugging
      console.error('Error adding event:', err)
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
      const errorMessage = err?.message || err?.details || err?.hint || 'Failed to add event. Please try again.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-4xl font-bold text-slate-900">Add New Event</h1>
          <p className="text-slate-600 mt-2">Add a new event to the Offhrs feed</p>
        </div>

        {/* Success Message */}
        {success && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">Event added successfully!</p>
                  <p className="text-sm text-green-700">The event has been added to the feed.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
              Fill in the details for the new event. Fields marked with * are required.
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
                  type="number"
                  min={15}
                  max={480}
                  value={formData.duration_minutes}
                  onChange={handleChange}
                  disabled={loading}
                />
                <p className="text-xs text-slate-500">Length of a single session (15–480 min). Shown in the app quick view and bookings.</p>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
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
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          recurrence: prev.recurrence === 'daily' ? 'none' : 'daily',
                        }))
                      }
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
                      All days are selected by default. Tap to exclude a day — no listing will be created
                      on deselected weekdays during the {recurringWeeks}-week window.
                    </p>
                  </div>
                )}
                {(formData.recurrence === 'weekly' || formData.recurrence === 'daily') && (
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

              {/* Organizer / Vendor */}
              <div className="space-y-2">
                <Label htmlFor="organizer">Organizer / Vendor</Label>
                <Input
                  id="organizer"
                  name="organizer"
                  value={formData.organizer}
                  onChange={handleChange}
                  placeholder="Enter organizer or vendor name (e.g. studio or host name)"
                  disabled={loading}
                />
              </div>

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
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding Event...
                  </>
                ) : (
                  'Add Event'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
