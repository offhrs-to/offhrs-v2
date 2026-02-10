'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import Navbar from '@/components/navbar'
import EventCard from '@/components/event-card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'

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
}

export default function WorkshopsPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('events')
      .select('id, title, description, date, location, image_url, external_link, category, is_multiple_dates, price, vendor_id')
      .order('date', { ascending: true, nullsFirst: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching events:', error)
          return
        }
        setEvents((data as EventRow[]) ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Navbar />
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

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#5D755D] mb-3" />
            <p className="text-gray-600 text-sm">Loading workshops...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-gray-600 mb-4 text-sm">No workshops at the moment. Check back soon.</p>
            <Link href="/">
              <Button variant="outline">Back to home</Button>
            </Link>
          </div>
        ) : (
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
        )}
      </main>
    </div>
  )
}
