'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { ExternalLink, Calendar, DollarSign } from 'lucide-react' // Import icons if you have them installed, or SVG below

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
}

export default function WorkshopMap({ events, center, zoom = 13 }: WorkshopMapProps) {
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
                  {event.image_url && (
                    <div 
                      className="h-32 w-full bg-cover bg-center rounded-t-md"
                      style={{ backgroundImage: `url(${event.image_url})` }}
                    />
                  )}

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

                    {/* 3. Link Button */}
                    {event.external_link && (
                      <a 
                        href={event.external_link}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-2 block w-full bg-black text-white text-xs font-bold text-center py-2 rounded hover:bg-gray-800 transition-colors"
                      >
                        View Workshop
                      </a>
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