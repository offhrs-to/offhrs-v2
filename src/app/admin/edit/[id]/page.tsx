'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'
import Navbar from '@/components/navbar'
import { Badge } from '@/components/ui/badge'
import { fetchUrlMetadata } from '@/app/actions/fetch-metadata'
import { updateEvent } from '@/app/actions/events'

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
}

export default function AdminEditPage() {
  const router = useRouter()
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
  })
  const [loading, setLoading] = useState(false)
  const [fetchingEvent, setFetchingEvent] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [coordinatesFound, setCoordinatesFound] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [fetchingMetadata, setFetchingMetadata] = useState(false)
  const [metadataSuccess, setMetadataSuccess] = useState(false)

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
        })

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
      [name]: type === 'checkbox' ? checked : value 
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
    
    // Skip geocoding if location is empty
    if (!location) {
      setCoordinatesFound(false)
      setFormData((prev) => ({ ...prev, lat: '', lng: '' }))
      return
    }

    // Skip geocoding for "Online" or similar keywords
    if (location.toLowerCase().includes('online') || location.toLowerCase().includes('virtual')) {
      setCoordinatesFound(false)
      setFormData((prev) => ({ ...prev, lat: '', lng: '' }))
      return
    }

    setGeocoding(true)
    setCoordinatesFound(false)

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`,
        {
          headers: {
            'User-Agent': 'Offhrs-App',
          },
        }
      )

      if (!response.ok) {
        throw new Error('Geocoding request failed')
      }

      const data = await response.json()

      if (data && data.length > 0) {
        const firstResult = data[0]
        const lat = firstResult.lat
        const lon = firstResult.lon

        setFormData((prev) => ({
          ...prev,
          lat: lat,
          lng: lon,
        }))
        setCoordinatesFound(true)
      } else {
        setCoordinatesFound(false)
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
      // Handle lat/lng - convert to string or number safely
      const lat = formData.lat !== null && formData.lat !== undefined && formData.lat !== ''
        ? (typeof formData.lat === 'string' ? formData.lat.trim() : String(formData.lat))
        : null
      
      const lng = formData.lng !== null && formData.lng !== undefined && formData.lng !== ''
        ? (typeof formData.lng === 'string' ? formData.lng.trim() : String(formData.lng))
        : null

      // Ensure date is stored as ISO string
      let formattedDate: string | null = null
      if (formData.date) {
        const trimmedDate = formData.date.trim()
        if (trimmedDate) {
          // If it's in datetime-local format (YYYY-MM-DDTHH:mm), convert to ISO
          if (trimmedDate.includes('T') && !trimmedDate.includes('Z') && trimmedDate.length === 16) {
            const date = new Date(trimmedDate)
            if (!isNaN(date.getTime())) {
              formattedDate = date.toISOString()
            } else {
              formattedDate = trimmedDate
            }
          } else {
            formattedDate = trimmedDate
          }
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
      }

      // Validate required fields
      if (!submitData.title) {
        throw new Error('Title is required')
      }

      // Update event using server action
      await updateEvent(eventId, submitData)

      // Redirect to dashboard on success
      router.push('/admin/dashboard')
    } catch (err: any) {
      console.error('Error updating event:', err)
      setError(err.message || 'Failed to update event. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (fetchingEvent) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="container mx-auto max-w-2xl py-12 px-4">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Loading event...</p>
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
            href="/admin/dashboard"
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
                <Input
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="e.g., Workshop, Conference, Meetup"
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

              {/* Date */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="date">
                    {formData.is_multiple_dates ? 'Next Upcoming Date (For Sorting)' : 'Date & Time'}
                  </Label>
                  <div className="flex items-center gap-2">
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
                  </div>
                </div>
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

              {/* Organizer */}
              <div className="space-y-2">
                <Label htmlFor="organizer">Organizer</Label>
                <Input
                  id="organizer"
                  name="organizer"
                  value={formData.organizer}
                  onChange={handleChange}
                  placeholder="Event organizer or host"
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
