'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import Navbar from '@/components/navbar'
import EventCard from '@/components/event-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Loader2, Search, LayoutGrid, MapPin, X, Smartphone, Calendar } from 'lucide-react'
import { CATEGORIES } from '@/constants/categories'

const WorkshopMap = dynamic(() => import('@/components/workshop-map'), { ssr: false })

const WORKSHOP_CATEGORIES = ['All', ...CATEGORIES]

const WORKSHOPS_GUEST_PROMPT_KEY = 'offhrs_workshops_guest_prompt_seen'

interface EventRow {
  id: number
  title: string
  description: string | null
  date: string | null
  location: string | null
  image_url: string | null
  external_link: string | null
  category: string | null
  is_multiple_dates: boolean | null
  price: number | string | null
  vendor_id: string | null
  lat?: number | null
  lng?: number | null
}

const DEFAULT_MAP_CENTER: [number, number] = [43.6532, -79.3832]

export default function WorkshopsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid')
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showGuestPrompt, setShowGuestPrompt] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [dateRangeStart, setDateRangeStart] = useState<string | null>(null)
  const [dateRangeEnd, setDateRangeEnd] = useState<string | null>(null)
  const [dateInputStart, setDateInputStart] = useState('')
  const [dateInputEnd, setDateInputEnd] = useState('')

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && !sessionStorage.getItem(WORKSHOPS_GUEST_PROMPT_KEY)) {
        setShowGuestPrompt(true)
      }
    } catch {
      setShowGuestPrompt(false)
    }
  }, [])

  const dismissGuestPrompt = (continueAsGuest: boolean) => {
    try {
      if (typeof window !== 'undefined') sessionStorage.setItem(WORKSHOPS_GUEST_PROMPT_KEY, '1')
    } catch {}
    setShowGuestPrompt(false)
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  const fetchEvents = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    try {
      let query = supabase
        .from('events')
        .select('id, title, description, date, location, image_url, external_link, category, is_multiple_dates, price, vendor_id, lat, lng')
        .order('date', { ascending: true, nullsFirst: false })

      if (debouncedSearch.trim()) {
        query = query.or(
          `title.ilike.%${debouncedSearch.trim()}%,category.ilike.%${debouncedSearch.trim()}%`
        )
      }
      if (selectedCategory !== 'All') {
        query = query.eq('category', selectedCategory)
      }

      const { data, error } = await query
      if (error) throw error

      const list = (data as EventRow[]) ?? []
      const now = new Date()
      // Exclude expired workshops (event date in the past); they remain visible in /admin for redirect review
      const upcoming = list.filter(
        (e) => !e.date || new Date(e.date) > now
      )
      const byDateRange = upcoming.filter((e) => {
        if (!e.date) return !dateRangeStart && !dateRangeEnd
        const eventDate = String(e.date).slice(0, 10)
        if (dateRangeStart && eventDate < dateRangeStart) return false
        if (dateRangeEnd && eventDate > dateRangeEnd) return false
        return true
      })
      setEvents(byDateRange)
    } catch (e) {
      console.error('Error fetching events:', e)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, selectedCategory, dateRangeStart, dateRangeEnd])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleClearFilters = () => {
    setSearchTerm('')
    setSelectedCategory('All')
    setDateRangeStart(null)
    setDateRangeEnd(null)
  }

  const hasActiveFilters =
    searchTerm.trim() !== '' || selectedCategory !== 'All' || dateRangeStart != null || dateRangeEnd != null

  const mapCenter = (() => {
    const withCoords = events.find(
      (e) =>
        e.lat != null &&
        e.lng != null &&
        !isNaN(Number(e.lat)) &&
        !isNaN(Number(e.lng)) &&
        Number(e.lat) !== 0 &&
        Number(e.lng) !== 0
    )
    if (withCoords) {
      return [Number(withCoords.lat), Number(withCoords.lng)] as [number, number]
    }
    return DEFAULT_MAP_CENTER
  })()

  const mapEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    location: e.location,
    image_url: e.image_url,
    external_link: e.external_link ?? undefined,
    is_multiple_dates: e.is_multiple_dates ?? false,
    price: e.price,
    lat: e.lat ?? null,
    lng: e.lng ?? null,
  }))

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Navbar />
      {/* First-visit prompt: app download / sign up or continue as guest */}
      {showGuestPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-prompt-title"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-[#5D755D]/10 p-3">
                <Smartphone className="h-8 w-8 text-[#5D755D]" />
              </div>
            </div>
            <h2 id="guest-prompt-title" className="text-lg font-bold text-gray-900 mb-2">
              Track your mastery
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              Download our app to track your progress and level up in your favourite skills.
            </p>
            <Button
              type="button"
              onClick={() => dismissGuestPrompt(true)}
              className="w-full bg-[#5D755D] hover:bg-[#5D755D]/90 text-white rounded-full"
            >
              Continue browsing as a guest
            </Button>
          </div>
        </div>
      )}
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="outline" size="icon" className="shrink-0 h-8 w-8">
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Workshops</h1>
              <p className="text-gray-600 mt-0.5 text-sm">Discover and book creative workshops</p>
            </div>
          </div>
        </div>

        {/* Search + Date + Clear row */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchEvents()}
              className="pl-9 h-9 rounded-full border-gray-200 bg-white"
            />
          </div>
          <div className="relative shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDateInputStart(dateRangeStart ?? '')
                setDateInputEnd(dateRangeEnd ?? '')
                setDatePickerOpen((v) => !v)
              }}
              className={`h-9 rounded-full border-gray-200 font-medium shrink-0 ${
                dateRangeStart ?? dateRangeEnd ? 'bg-[#5D755D] text-white border-[#5D755D]' : 'text-[#5D755D]'
              }`}
            >
              <Calendar className="h-4 w-4 mr-1.5" />
              Date
            </Button>
            {datePickerOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden
                  onClick={() => setDatePickerOpen(false)}
                />
                <div className="absolute top-full right-0 z-20 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
                  <p className="text-sm font-semibold text-gray-900 mb-3">Filter by date range</p>
                  <div className="space-y-2 mb-3">
                    <label htmlFor="workshop-date-from" className="text-xs text-gray-500 block">From</label>
                    <input
                      id="workshop-date-from"
                      type="date"
                      value={dateInputStart}
                      onChange={(e) => setDateInputStart(e.target.value)}
                      className="w-full h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 cursor-pointer"
                      aria-label="From date"
                    />
                  </div>
                  <div className="space-y-2 mb-4">
                    <label htmlFor="workshop-date-to" className="text-xs text-gray-500 block">To</label>
                    <input
                      id="workshop-date-to"
                      type="date"
                      value={dateInputEnd}
                      onChange={(e) => setDateInputEnd(e.target.value)}
                      className="w-full h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 cursor-pointer"
                      aria-label="To date"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDateRangeStart(null)
                        setDateRangeEnd(null)
                        setDateInputStart('')
                        setDateInputEnd('')
                        setDatePickerOpen(false)
                      }}
                      className="flex-1 h-9 rounded-lg border-gray-200 text-[#5D755D]"
                    >
                      Clear dates
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setDateRangeStart(dateInputStart.trim() ? dateInputStart.trim().slice(0, 10) : null)
                        setDateRangeEnd(dateInputEnd.trim() ? dateInputEnd.trim().slice(0, 10) : null)
                        setDatePickerOpen(false)
                      }}
                      className="flex-1 h-9 rounded-lg bg-[#5D755D] text-white"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="h-9 rounded-full border-gray-200 text-[#5D755D] font-medium shrink-0"
          >
            <X className="h-4 w-4 mr-1.5" />
            Clear
          </Button>
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
          {WORKSHOP_CATEGORIES.map((cat) => {
            const isActive = cat === 'All' ? selectedCategory === 'All' : selectedCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 h-9 px-3 rounded-full text-sm font-medium border transition-colors ${
                  isActive
                    ? 'bg-[#5D755D] text-white border-[#5D755D]'
                    : 'bg-white text-[#5D755D] border-gray-200 hover:border-[#5D755D]/50'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>

        {/* View toggle: Grid | Map */}
        <div className="flex gap-1 p-1 rounded-lg bg-gray-100 w-fit mb-4">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Grid
          </button>
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'map' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <MapPin className="h-4 w-4" />
            Map
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#5D755D] mb-3" />
            <p className="text-gray-600 text-sm">Loading workshops...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-gray-600 mb-4 text-sm">
              No workshops found. Try different search or filters, or check back later.
            </p>
            <Button variant="outline" onClick={handleClearFilters}>
              Clear filters
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={{
                  id: event.id,
                  title: event.title,
                  description: event.description ?? '',
                  date: event.date,
                  location: event.location,
                  image_url: event.image_url,
                  category: event.category ?? 'Other',
                  is_multiple_dates: event.is_multiple_dates ?? false,
                  external_link: event.external_link ?? undefined,
                  price: event.price,
                  vendor_id: event.vendor_id,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm h-[500px] min-h-[400px]">
            <WorkshopMap events={mapEvents} center={mapCenter} zoom={11} />
          </div>
        )}
      </main>
    </div>
  )
}
