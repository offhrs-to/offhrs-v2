'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Calendar, MapPin, ExternalLink, DollarSign, Heart } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/browser'
import { EventImageFallback } from '@/components/event-image-fallback'
import { BookOutboundHint } from '@/components/listing-disclaimer'
import { openWorkshopBooking } from '@/lib/workshop-outbound'
import { formatVenueAddress } from '@/lib/venue-address'

interface Event {
  id: number | string
  title: string
  description: string
  date: string | null | undefined
  location: string | null | undefined
  location_unit?: string | null
  image_url: string | null
  category: string
  is_multiple_dates?: boolean | null
  external_link?: string
  price?: number | string | null
  vendor_id?: string | null
  vendor_profile_id?: string | null
  listing_source?: string | null
  shopify_product_id?: string | null
}

function eventBooksOnShopify(event: {
  listing_source?: string | null
  shopify_product_id?: string | null
}): boolean {
  if (event.listing_source === 'shopify') return true
  return event.shopify_product_id != null && String(event.shopify_product_id).length > 0
}

export default function EventCard({
  event,
  onOpenQuickView,
}: {
  event: Event
  /** When set, clicking the card (not Book / vendor / save) opens the workshop quick view. */
  onOpenQuickView?: () => void
}) {
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
  
  const isSaasEvent = !!event.vendor_profile_id && !eventBooksOnShopify(event)

  const handleBookClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isSaasEvent) {
      window.location.href = `/workshops/${event.id}`
      return
    }
    openWorkshopBooking({
      id: event.id,
      title: event.title,
      category: event.category,
      price: event.price,
      external_link: event.external_link,
    })
  }

  const handleCardActivate = () => {
    onOpenQuickView?.()
  }

  // Format Date Logic: show earliest date + "Multiple dates" when applicable
  const formattedDate = event.date
    ? new Date(event.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : null
  const displayDate = event.is_multiple_dates
    ? (formattedDate ? `${formattedDate} • Multiple dates` : 'Multiple dates')
    : (formattedDate ?? 'Date TBD')

  return (
    <div
      className={`group bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 overflow-hidden flex flex-col h-full ${
        onOpenQuickView ? 'cursor-pointer' : ''
      }`}
      onClick={onOpenQuickView ? handleCardActivate : undefined}
    >
      {/* Image Section */}
      <div className="relative h-36 w-full overflow-hidden bg-gray-100">
        <EventImageFallback
          mode="fill"
          imageUrl={event.image_url}
          category={event.category}
          alt={event.title}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          imageClassName="object-cover group-hover:scale-105 transition-transform duration-500"
        />
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
            <span className="line-clamp-1">
              {formatVenueAddress(event.location, event.location_unit) || 'Location TBD'}
            </span>
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
              onClick={(e) => e.stopPropagation()}
            >
              View vendor
            </Link>
          )}
          <BookOutboundHint className="mb-1.5" />
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