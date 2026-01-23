'use client'

import Image from 'next/image'
import { Calendar, MapPin, ExternalLink } from 'lucide-react'

interface Event {
  id: number
  title: string
  description: string
  date: string
  location: string
  image_url: string
  category: string
  is_multiple_dates?: boolean | null
  external_link: string
}

export default function EventCard({ event }: { event: Event }) {
  
  const handleBookClick = (e: React.MouseEvent) => {
    e.preventDefault() // Stop default link behavior immediately
    
    // 1. Fire Google Analytics Event
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'generate_lead', {
        currency: 'CAD',
        value: 10.00,
        event_label: event.title,
        event_category: 'outbound_click'
      })
    }

    // 2. Fire Meta (Facebook) Pixel Lead
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'Lead', {
        content_name: event.title,
        content_category: event.category,
        value: 1.00,
        currency: 'CAD'
      })
      console.log('Pixel Fired: Lead')
    }

    // 3. Small delay to ensure pixels fire, then open link
    setTimeout(() => {
      window.open(event.external_link, '_blank')
    }, 150)
  }

  // Format Date Logic
  const displayDate = event.is_multiple_dates 
    ? 'Multiple Dates' 
    : new Date(event.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })

  return (
    <div className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 overflow-hidden flex flex-col h-full">
      {/* Image Section */}
      <div className="relative h-48 w-full overflow-hidden bg-gray-100">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-400">
            No Image
          </div>
        )}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-gray-700 shadow-sm">
          {event.category}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">
          {event.title}
        </h3>
        
        <div className="space-y-2 mb-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span className={event.is_multiple_dates ? "font-medium text-blue-600" : ""}>
              {displayDate}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-red-500" />
            <span className="line-clamp-1">{event.location}</span>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-gray-50">
          <button
            onClick={handleBookClick}
            className="w-full bg-black hover:bg-gray-800 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
          >
            Visit Website
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}