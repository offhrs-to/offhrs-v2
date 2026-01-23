'use client'

import { useState, FormEvent } from 'react'
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
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [coordinatesFound, setCoordinatesFound] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [fetchingMetadata, setFetchingMetadata] = useState(false)
  const [metadataSuccess, setMetadataSuccess] = useState(false)

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
    setSuccess(false)

    try {
      // Prepare data for Supabase (handle empty strings as null)
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
        lat: formData.lat.trim() || null,
        lng: formData.lng.trim() || null,
        is_multiple_dates: formData.is_multiple_dates,
      }

      // Validate required fields
      if (!submitData.title) {
        throw new Error('Title is required')
      }

      const { error: insertError } = await supabase
        .from('events')
        .insert([submitData])

      if (insertError) throw insertError

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
      })
      setUrlInput('')
      setCoordinatesFound(false)
      setMetadataSuccess(false)

      // Hide success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000)
    } catch (err: any) {
      console.error('Error adding event:', err)
      setError(err.message || 'Failed to add event. Please try again.')
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
            href="/admin/dashboard"
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
