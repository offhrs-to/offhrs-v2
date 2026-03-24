'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Info } from 'lucide-react'
import { EventImageFallback } from '@/components/event-image-fallback'

// --- Fix for missing Leaflet Marker Icons ---
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34], // Adjusted so popup opens nicely above the pin
})
L.Marker.prototype.options.icon = DefaultIcon

// --- HELPER: Moves the map when center changes ---
function MapController({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, map.getZoom())
  }, [center, map])
  return null
}

// --- TYPE DEFINITIONS ---
interface Event {
  id: number | string
  title: string
  lat: number | string | null
  lng: number | string | null
  image_url: string | null
  category?: string | null
  date: string | null | undefined
  location: string | null | undefined
  external_link?: string
  is_multiple_dates?: boolean | null
  price?: number | string | null // Added price field
}

interface WorkshopMapProps {
  events: Event[]
  center: [number, number] | null
  zoom?: number
  /** Opens the same workshop quick view as the grid (by event id). */
  onOpenDetails?: (eventId: number) => void
}

export default function WorkshopMap({ events, center, zoom = 13, onOpenDetails }: WorkshopMapProps) {
  useEffect(() => {
    window.dispatchEvent(new Event('resize'))
  }, [])

  const safeCenter: [number, number] = center || [43.6532, -79.3832]

  return (
    <div className="h-full w-full rounded-lg overflow-hidden z-0 isolate">
      <MapContainer 
        center={safeCenter} 
        zoom={zoom} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <MapController center={safeCenter} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {events.map((event) => {
          const latNum = Number(event.lat)
          const lngNum = Number(event.lng)
          const isValid = !isNaN(latNum) && !isNaN(lngNum) && latNum !== 0 && lngNum !== 0

          if (!isValid) return null

          // Date Formatting Logic: show earliest date + "Multiple dates" when applicable
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
            <Marker key={event.id} position={[latNum, lngNum]}>
              <Popup className="custom-popup">
                {/* POPUP CARD DESIGN */}
                <div className="w-56 p-0 overflow-hidden">
                  
                  {/* 1. Image Header */}
                  <div className="relative h-32 w-full overflow-hidden rounded-t-md bg-gray-100">
                    <EventImageFallback
                      mode="fill"
                      imageUrl={event.image_url}
                      category={event.category}
                      alt={event.title}
                      sizes="224px"
                      imageClassName="object-cover"
                    />
                  </div>

                  {/* 2. Content */}
                  <div className="p-3">
                    <h3 className="font-bold text-sm text-gray-900 leading-tight mb-2">
                      {event.title}
                    </h3>
                    
                    {/* Date */}
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                      <span className="font-medium">📅 {displayDate}</span>
                    </div>

                    {/* Price (Only show if exists) */}
                    {event.price && (
                       <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <span className="font-medium">💵 ${event.price}</span>
                      </div>
                    )}

                    {/* 3. Details + external link */}
                    {(onOpenDetails || event.external_link) && (
                      <div className="mt-2 flex flex-col gap-2">
                        {onOpenDetails && typeof event.id === 'number' && (
                          <button
                            type="button"
                            onClick={() => onOpenDetails(event.id as number)}
                            className="flex w-full items-center justify-center gap-1.5 rounded border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
                          >
                            <Info className="h-3.5 w-3.5 shrink-0" />
                            Details
                          </button>
                        )}
                        {event.external_link && (
                          <a
                            href={event.external_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full bg-black text-white text-xs font-bold text-center py-2 rounded hover:bg-gray-800 transition-colors"
                          >
                            View Workshop
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}