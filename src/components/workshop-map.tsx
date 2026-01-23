'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// --- Fix for missing Leaflet Marker Icons ---
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

// --- ULTRA-PERMISSIVE TYPE DEFINITIONS ---
interface Event {
  // We allow string, number, null, or undefined for almost everything
  // This matches whatever Supabase or your Page sends
  id: number | string
  title: string
  lat: number | string | null
  lng: number | string | null
  image_url: string | null
  // The specific fix for your error:
  date: string | null | undefined 
  location: string | null | undefined
}

interface WorkshopMapProps {
  events: Event[]
  center: [number, number] | null
  zoom?: number
}

export default function WorkshopMap({ events, center, zoom = 13 }: WorkshopMapProps) {
  useEffect(() => {
    // Force map resize on load
    window.dispatchEvent(new Event('resize'))
  }, [])

  const safeCenter: [number, number] = center || [43.6532, -79.3832]

  return (
    <div className="h-full w-full rounded-lg overflow-hidden z-0">
      <MapContainer 
        center={safeCenter} 
        zoom={zoom} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {events.map((event) => {
          const latNum = Number(event.lat)
          const lngNum = Number(event.lng)
          const isValid = !isNaN(latNum) && !isNaN(lngNum) && latNum !== 0 && lngNum !== 0

          if (!isValid) return null

          return (
            <Marker key={event.id} position={[latNum, lngNum]}>
              <Popup>
                <div className="text-sm font-medium text-gray-900">
                  {event.title}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}