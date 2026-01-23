'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Calendar, MapPin, User, List, Map } from 'lucide-react'
import Image from 'next/image'
import Navbar from '@/components/navbar'
import SearchToolbar from '@/components/search-toolbar'

// Dynamically import map to avoid SSR issues
const WorkshopMap = dynamic(() => import('@/components/workshop-map'), {
  ssr: false,
})

interface Event {
  id: string
  title: string
  mode: string
  category: string
  price: string | null
  date: string | null
  location: string | null
  organizer: string | null
  image_url: string | null
  external_link: string | null
  lat: string | null
  lng: string | null
  is_multiple_dates: boolean | null
}

type ViewMode = 'list' | 'map'

export default function WorkshopsPage() {
  const searchParams = useSearchParams()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)

  useEffect(() => {
    fetchEvents()
  }, [searchParams])

  const fetchEvents = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('events')
        .select('id, title, mode, category, price, date, location, organizer, image_url, external_link, lat, lng, is_multiple_dates')
        .eq('mode', 'craft')

      // Filter by search query
      const searchQuery = searchParams.get('query')
      if (searchQuery) {
        query = query.ilike('title', `%${searchQuery}%`)
      }

      // Filter by category
      const category = searchParams.get('category')
      if (category && category !== 'All') {
        query = query.eq('category', category)
      }

      // Order by date
      query = query.order('date', { ascending: true })

      const { data, error } = await query

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Date TBD'
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-US', {
        timeZone: 'America/Toronto',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return dateString
    }
  }

  const formatPrice = (price: string | null) => {
    if (!price) return 'Free'
    return price
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Workshops</h1>
          <p className="text-slate-600">Discover Toronto's best leisure workshops</p>
        </div>

        {/* Search Toolbar */}
        <SearchToolbar onLocationChange={setMapCenter} />

        {/* View Toggle */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'bg-moss hover:bg-moss-dark text-white' : ''}
            >
              <List className="h-4 w-4 mr-2" />
              List
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('map')}
              className={viewMode === 'map' ? 'bg-moss hover:bg-moss-dark text-white' : ''}
            >
              <Map className="h-4 w-4 mr-2" />
              Map
            </Button>
          </div>
        </div>

        {/* Content based on view mode */}
        {viewMode === 'map' ? (
          /* Map View */
          <WorkshopMap events={events} center={mapCenter} />
        ) : (
          /* List View - Events Grid */
          <>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-slate-600">Loading events...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-600">No events found. Check back soon!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => (
                  <Card
                    key={event.id}
                    className="overflow-hidden transition-all duration-200 hover:shadow-lg border-gray-200 hover:border-moss"
                  >
                    {/* Image */}
                    <div className="relative h-48 w-full bg-gray-200">
                      {event.image_url ? (
                        <Image
                          src={event.image_url}
                          alt={event.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-moss/10">
                          <span className="text-slate-400 text-sm">No Image</span>
                        </div>
                      )}
                    </div>

                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-xl font-semibold text-slate-900 line-clamp-2">
                          {event.title}
                        </CardTitle>
                        {event.category && (
                          <Badge
                            variant="secondary"
                            className="bg-moss/10 text-moss"
                          >
                            {event.category}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {/* Organizer */}
                      {event.organizer && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <User className="h-4 w-4" />
                          <span className="truncate">{event.organizer}</span>
                        </div>
                      )}

                      {/* Date */}
                      {event.date && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {event.is_multiple_dates ? (
                              <Badge variant="secondary" className="bg-moss/10 text-moss">
                                Multiple Dates
                              </Badge>
                            ) : (
                              formatDate(event.date)
                            )}
                          </span>
                        </div>
                      )}

                      {/* Location */}
                      {event.location && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}

                      {/* Price */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="font-semibold text-moss">
                          {formatPrice(event.price)}
                        </span>

                        {/* Visit Website Button */}
                        {event.external_link && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 border-moss text-moss hover:bg-moss/10"
                            onClick={() => window.open(event.external_link!, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                            Visit Website
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}


        {/* Footer Link to Admin */}
        <div className="mt-12 text-center">
          <a
            href="/admin/add"
            className="text-sm text-slate-500 hover:text-slate-700 underline"
          >
            Add Event (Admin)
          </a>
        </div>
      </main>
    </div>
  )
}
