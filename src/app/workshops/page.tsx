'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import nextDynamic from 'next/dynamic'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import EventCard from '@/components/event-card'
import { Search, MapPin } from 'lucide-react'

// Load Map dynamically
const WorkshopMap = nextDynamic(() => import('@/components/workshop-map'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400">Loading Map...</div>
})

interface Event {
  id: number
  title: string
  description: string
  date: string
  location: string
  price: number | string 
  image_url: string
  category: string
  lat: number | null
  lng: number | null
  is_multiple_dates: boolean | null
  external_link: string
}

function WorkshopsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // State for Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'All')
  const [locationFilter, setLocationFilter] = useState('')
  
  // State for Data
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid')

  // --- UPDATED CATEGORIES ---
  const categories = [
    'All', 
    'Beauty & Fragrance', 
    'Culinary', 
    'Coffee', 
    'Floral', 
    'Pottery', 
    'Textiles', 
    'Music', 
    'Wellness', 
    'Other'
  ]

  // Fetch when filters change
  useEffect(() => {
    fetchEvents()
  }, [selectedCategory, searchTerm, locationFilter])

  async function fetchEvents() {
    try {
      setLoading(true)
      let query = supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true })

      // 1. Category Filter
      if (selectedCategory && selectedCategory !== 'All') {
        query = query.eq('category', selectedCategory)
      }

      // 2. Search Text Filter
      if (searchTerm) {
        query = query.ilike('title', `%${searchTerm}%`)
      }

      // 3. Simple Location Text Filter
      if (locationFilter) {
        query = query.ilike('location', `%${locationFilter}%`)
      }

      const { data, error } = await query

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat)
    if (cat === 'All') {
      router.push('/workshops')
    } else {
      router.push(`/workshops?category=${encodeURIComponent(cat)}`)
    }
  }

  // Default center (Toronto) or the first event's location
  const mapCenter: [number, number] = events[0]?.lat && events[0]?.lng 
    ? [events[0].lat!, events[0].lng!] 
    : [43.6532, -79.3832]

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Page Header Section */}
      <div className="bg-white border-b border-gray-100 pt-8 pb-6 px-4">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold text-gray-900">Explore Workshops</h1>
          <p className="text-gray-500 mt-2">Find your next creative obsession in Toronto</p>

          {/* SEARCH & FILTER BAR */}
          <div className="mt-6 flex flex-col md:flex-row gap-4">
            
            {/* Search Input */}
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text"
                placeholder="Search workshops..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Simple Location Filter */}
            <div className="relative md:w-64">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text"
                placeholder="Filter by city..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              />
            </div>

            {/* View Toggle */}
            <div className="bg-gray-100 p-1 rounded-lg flex shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'map' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Map
              </button>
            </div>
          </div>

          {/* Categories Scroll Bar */}
          <div className="mt-6 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-black text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-xl font-medium text-gray-900">No workshops found</h3>
            <p className="text-gray-500 mt-2">Try adjusting your filters.</p>
            <button 
              onClick={() => {setSearchTerm(''); setLocationFilter(''); setSelectedCategory('All')}}
              className="mt-4 text-blue-600 font-medium hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            {viewMode === 'map' ? (
              <div className="h-[600px] w-full rounded-xl overflow-hidden shadow-lg border border-gray-200">
                <WorkshopMap events={events} center={mapCenter} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function WorkshopsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <WorkshopsContent />
    </Suspense>
  )
}