'use client'

import { useCallback, useEffect, useRef } from 'react'

type Props = {
  /** Shown once when the field mounts; user edits in the DOM (Places-friendly). */
  initialValue: string
  onAddressChange: (address: string) => void
  onPlaceResolved: (payload: { lat: number; lng: number; formattedAddress: string }) => void
  onClearGeocode: () => void
  apiKey: string | undefined
  disabled?: boolean
}

const inputClassName =
  'w-full rounded-lg border border-[#D9D7CF] bg-[#FAFAF8] px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#AAA] focus:outline-none focus:ring-2 focus:ring-[#5D755D] disabled:opacity-50'

/**
 * Google Maps Places Autocomplete. Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * with Maps JavaScript API + Places API enabled and HTTP referrer restrictions.
 * Input stays uncontrolled so the Places widget can manage suggestions reliably.
 */
export function GooglePlacesField({
  initialValue,
  onAddressChange,
  onPlaceResolved,
  onClearGeocode,
  apiKey,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const acRef = useRef<google.maps.places.Autocomplete | null>(null)

  useEffect(() => {
    const el = inputRef.current
    if (el && initialValue && !el.value) el.value = initialValue
  }, [initialValue])

  const attach = useCallback(() => {
    const input = inputRef.current
    if (!input || !window.google?.maps?.places) return

    if (acRef.current) {
      google.maps.event.clearInstanceListeners(acRef.current)
      acRef.current = null
    }

    const ac = new google.maps.places.Autocomplete(input, {
      fields: ['formatted_address', 'geometry', 'name'],
      types: ['establishment', 'geocode'],
    })

    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      const loc = place.geometry?.location
      if (!loc) return
      const lat = loc.lat()
      const lng = loc.lng()
      const formatted =
        place.formatted_address ?? place.name ?? input.value
      input.value = formatted
      onAddressChange(formatted)
      onPlaceResolved({ lat, lng, formattedAddress: formatted })
    })

    acRef.current = ac
  }, [onAddressChange, onPlaceResolved])

  useEffect(() => {
    if (!apiKey || disabled) return

    if (window.google?.maps?.places) {
      attach()
      return
    }

    const id = 'google-maps-js'
    if (document.getElementById(id)) {
      const t = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(t)
          attach()
        }
      }, 100)
      return () => clearInterval(t)
    }

    const script = document.createElement('script')
    script.id = id
    script.async = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`
    script.onload = () => attach()
    document.head.appendChild(script)

    return () => {
      if (acRef.current) {
        google.maps.event.clearInstanceListeners(acRef.current)
        acRef.current = null
      }
    }
  }, [apiKey, disabled, attach])

  return (
    <div className="space-y-2">
      <label htmlFor="venue-address" className="block text-sm font-medium text-[#1a1a1a]">
        Search for your venue
      </label>
      <input
        ref={inputRef}
        id="venue-address"
        type="text"
        autoComplete="off"
        defaultValue={initialValue}
        disabled={disabled}
        onInput={() => {
          const v = inputRef.current?.value ?? ''
          onAddressChange(v)
          onClearGeocode()
        }}
        placeholder="Start typing an address or business name…"
        className={inputClassName}
      />
      {!apiKey && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Maps key is not configured. Enter your full street address; you can refine the map pin later from Settings.
        </p>
      )}
    </div>
  )
}
