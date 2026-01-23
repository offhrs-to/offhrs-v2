'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import Link from 'next/link'

// Fix for default marker icons in Next.js
export default function WorkshopMap({ events, center, zoom = 13 }: WorkshopMapProps) {
  // Set icon URLs in useEffect
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
  }, [])

interface Event {
  id: string
  title: string
  lat: string | null
  lng: string | null
  location: string | null
  external_link: string | null
}

interface WorkshopMapProps {
  events: Event[]
  center?: [number, number] | null
  zoom?: number
}

// Component to handle map center updates
function MapController({ center, zoom }: { center?: [number, number] | null; zoom?: number }) {
  const map = useMap()
  
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 13, {
        duration: 1.5,
      })
    }
  }, [center, zoom, map])

  return null
}
  // Default center (Toronto)
  const defaultCenter: [number, number] = [43.6532, -79.3832]

  // Filter events that have coordinates
  const eventsWithCoords = events.filter(
    (event) => event.lat && event.lng && !isNaN(parseFloat(event.lat)) && !isNaN(parseFloat(event.lng))
  )

  return (
    <div className="w-full h-[600px] rounded-lg overflow-hidden border border-gray-200">
      <MapContainer
        center={center || defaultCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <MapController center={center} zoom={zoom} />
        
        {eventsWithCoords.map((event) => (
          <Marker
            key={event.id}
            position={[parseFloat(event.lat!), parseFloat(event.lng!)]}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-slate-900 mb-2">{event.title}</h3>
                {event.location && (
                  <p className="text-sm text-slate-600 mb-2">{event.location}</p>
                )}
                {event.external_link && (
                  <Link
                    href={event.external_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 px-3 py-1 bg-moss text-white text-sm rounded-md hover:bg-moss-dark transition-colors"
                  >
                    Book
                  </Link>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
