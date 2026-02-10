'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Calendar, MapPin, ExternalLink, DollarSign, Heart } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/browser'

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
  price?: number | string | null
  vendor_id?: string | null
}

export default function EventCard({ event }: { event: Event }) {
  const { user } = useAuth()
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user?.id || !event.vendor_id) return

    const supabase = createClient()
    supabase
      .from('user_vendor_saves')
      .select('id')
      .eq('user_id', user.id)
      .eq('vendor_id', event.vendor_id)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data))
  }, [user?.id, event.vendor_id])

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user || !event.vendor_id || saving) return

    setSaving(true)
    const supabase = createClient()

    if (saved) {
      await supabase
        .from('user_vendor_saves')
        .delete()
        .eq('user_id', user.id)
        .eq('vendor_id', event.vendor_id)
      setSaved(false)
    } else {
      await supabase
        .from('user_vendor_saves')
        .insert({ user_id: user.id, vendor_id: event.vendor_id })
      setSaved(true)
    }
    setSaving(false)
  }
  
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

    // Create booking & send confirmation email if logged in
    if (user?.id) {
      fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          event_title: event.title,
        }),
      }).catch(() => {})
    }

    // Open external link
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
    <div className="group bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 overflow-hidden flex flex-col h-full">
      {/* Image Section */}
      <div className="relative h-36 w-full overflow-hidden bg-gray-100">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">
            No Image
          </div>
        )}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-semibold text-gray-700 shadow-sm">
            {event.category}
          </span>
          {user && event.vendor_id && (
            <button
              onClick={handleSave}
              disabled={saving}
              className={`p-1.5 rounded-full bg-white/90 backdrop-blur-sm shadow-sm ${
                saved ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
              }`}
            >
              <Heart className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="font-bold text-base text-gray-900 mb-1.5 line-clamp-1 group-hover:text-[#5D755D] transition-colors">
          {event.title}
        </h3>
        
        <div className="space-y-1.5 mb-3 text-xs text-gray-600">
          {/* Date */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#5D755D] shrink-0" />
            <span className={event.is_multiple_dates ? "font-medium text-[#5D755D]" : ""}>
              {displayDate}
            </span>
          </div>

          {/* Location */}
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="line-clamp-1">{event.location || 'Location TBD'}</span>
          </div>

          {/* Price - NEW SECTION */}
          {event.price && (
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="font-medium text-gray-900">
                ${event.price} <span className="text-gray-400 font-normal"></span>
              </span>
            </div>
          )}
        </div>

        <div className="mt-auto pt-3 border-t border-gray-50">
          {event.vendor_id && (
            <Link
              href={`/vendors/${event.vendor_id}`}
              className="text-[10px] text-[#5D755D] hover:underline mb-1.5 block"
            >
              View vendor
            </Link>
          )}
          <button
            onClick={handleBookClick}
            className="w-full bg-black hover:bg-gray-800 text-white font-medium py-2 px-3 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            Book
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}