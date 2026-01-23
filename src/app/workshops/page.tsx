'use client'

// 1. Force dynamic rendering for search params
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import nextDynamic from 'next/dynamic' // Renamed to avoid clash with 'export const dynamic'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import EventCard from '@/components/event-card'

// 2. Load Map dynamically (Client side only)
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
  image_url: string
  category: string
  lat: number | null
  lng: number | null
  is_multiple_dates: boolean | null // Added based on your earlier request
  external_link: string
}

// 3. The Main Logic Component (Not exported directly)
function WorkshopsContent() {
  const searchParams = useSearchParams()
  const categoryFilter = searchParams.get('category')
  
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid')

  useEffect(() => {
    fetchEvents()
  }, [categoryFilter])

  async function fetchEvents() {
    try {
      setLoading(true)
      let query = supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true })

      if (categoryFilter) {
        query = query.eq('category', categoryFilter)
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

  // Calculate map center based on first event, or default to Toronto
  const mapCenter: [number, number] = events[0]?.lat && events[0]?.lng 
    ? [events[0].lat!, events[0].lng!] 
    : [43.6532, -79.3832]

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {categoryFilter ? `${categoryFilter} Workshops` : 'Upcoming Workshops'}
          </h1>
          <p className="text-gray-600 mt-1">Discover local creative experiences in Toronto</p>
        </div>

        {/* View Toggle */}
        <div className="bg-gray-100 p-1 rounded-lg flex">
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

      {/* Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-96 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl">
          <h3 className="text-xl font-medium text-gray-900">No workshops found</h3>
          <p className="text-gray-500 mt-2">Try adjusting your filters or check back later.</p>
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
  )
}

// 4. The Wrapper Component (Exported Default)
// This Suspense boundary fixes the "useSearchParams" build error
export default function WorkshopsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <WorkshopsContent />
    </Suspense>
  )
}