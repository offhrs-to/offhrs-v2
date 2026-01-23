'use client'

import Image from 'next/image'
import { Calendar, MapPin, ExternalLink, DollarSign } from 'lucide-react' // Added DollarSign icon

interface Event {
  id: number | string
  title: string
  description: string
  date: string | null | undefined
  location: string | null | undefined
  image_url: string | null
  category: string
  is_multiple_dates?: boolean | null
  external_link?: string
  price?: number | string | null // Ensure price is included here
}

export default function EventCard({ event }: { event: Event }) {
  
  const handleBookClick = (e: React.MouseEvent) => {
    e.preventDefault()
    
    // 1. Google Analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'generate_lead', {
        currency: 'CAD',
        value: event.price ? Number(event.price) : 0, // Track actual price value if available
        event_label: event.title,
        event_category: 'outbound_click'
      })
    }

    // 2. Meta Pixel
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'Lead', {
        content_name: event.title,
        content_category: event.category,
        value: event.price ? Number(event.price) : 0,
        currency: 'CAD'
      })
    }

    // 3. Open Link
    if (event.external_link) {
      setTimeout(() => {
        window.open(event.external_link, '_blank')
      }, 150)
    }
  }

  // Format Date Logic
  const displayDate = event.is_multiple_dates 
    ? 'Multiple Dates' 
    : event.date
      ? new Date(event.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      : 'Date TBD'

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
        <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-1 group-hover:text-[#5D755D] transition-colors">
          {event.title}
        </h3>
        
        <div className="space-y-2 mb-4 text-sm text-gray-600">
          {/* Date */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#5D755D]" />
            <span className={event.is_multiple_dates ? "font-medium text-[#5D755D]" : ""}>
              {displayDate}
            </span>
          </div>

          {/* Location */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="line-clamp-1">{event.location || 'Location TBD'}</span>
          </div>

          {/* Price - NEW SECTION */}
          {event.price && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-900">
                ${event.price} <span className="text-gray-400 font-normal"></span>
              </span>
            </div>
          )}
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