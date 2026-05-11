'use client'

import { useCallback, useEffect, useRef } from 'react'

type Props = {
  /** Shown once when the field mounts; user edits in the DOM (Places-friendly). */
  initialValue: string
  onAddressChange: (address: string) => void
  onPlaceResolved: (payload: { lat: number; lng: number; formattedAddress: string }) => void
  onClearGeocode: () => void
  /** Called when Google Maps fails auth (e.g. RefererNotAllowedMapError). Set before the script loads. */
  onAuthFailure?: () => void
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
/** ms — buffer after commit for any trailing DOM `input` events */
const SUPPRESS_CLEAR_MS = 1500
/** Autocomplete fires `input` before `place_changed`; defer clear so selection can commit coords first */
const CLEAR_GEOCODE_DEBOUNCE_MS = 280

function normalizeAddress(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function GooglePlacesField({
  initialValue,
  onAddressChange,
  onPlaceResolved,
  onClearGeocode,
  onAuthFailure,
  apiKey,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const acRef = useRef<google.maps.places.Autocomplete | null>(null)
  const suppressClearUntilRef = useRef(0)
  /** While Details / Geocoder runs, never clear coords — `input` fires with partial text first. */
  const resolvingPlaceRef = useRef(false)
  /** Last successful formatted address we committed (avoid clearing when input matches after programmatic fill). */
  const lastCommittedFormattedRef = useRef<string | null>(null)
  const pendingClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelPendingClearGeocode = useCallback(() => {
    if (pendingClearTimeoutRef.current != null) {
      clearTimeout(pendingClearTimeoutRef.current)
      pendingClearTimeoutRef.current = null
    }
  }, [])

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
      fields: ['formatted_address', 'geometry', 'name', 'address_components'],
      types: ['establishment', 'geocode'],
    })

    const detailFields: string[] = [
      'formatted_address',
      'geometry',
      'address_components',
      'name',
    ]

    const commitResolved = (lat: number, lng: number, formatted: string) => {
      cancelPendingClearGeocode()
      resolvingPlaceRef.current = false
      lastCommittedFormattedRef.current = formatted.trim()
      suppressClearUntilRef.current = Date.now() + SUPPRESS_CLEAR_MS
      input.value = formatted
      onAddressChange(formatted)
      onPlaceResolved({ lat, lng, formattedAddress: formatted })
    }

    const detailsOk = (status: string) =>
      status === 'OK' || status === google.maps.places.PlacesServiceStatus.OK

    /** Autocomplete `getPlace()` often omits postal code on the first selection; Details returns the canonical address. */
    const fetchDetailsAndCommit = (
      placeId: string,
      fallbackPlace: google.maps.places.PlaceResult
    ) => {
      suppressClearUntilRef.current = Date.now() + 20000
      const dummy = document.createElement('div')
      const service = new google.maps.places.PlacesService(dummy)
      service.getDetails(
        {
          placeId,
          fields: detailFields,
        },
        (detailed, status) => {
          if (detailsOk(String(status)) && detailed?.geometry?.location) {
            const loc = detailed.geometry.location
            const formatted =
              detailed.formatted_address ??
              detailed.name ??
              input.value?.trim() ??
              ''
            commitResolved(loc.lat(), loc.lng(), formatted)
            return
          }
          const fb = fallbackPlace.geometry?.location
          const hint =
            fallbackPlace.formatted_address ??
            fallbackPlace.name ??
            input.value?.trim() ??
            ''
          if (fb) {
            commitResolved(fb.lat(), fb.lng(), hint)
            return
          }
          if (hint) {
            suppressClearUntilRef.current = Date.now() + 15000
            const geocoder = new google.maps.Geocoder()
            geocoder.geocode({ address: hint }, (results, gStatus) => {
              if (gStatus !== 'OK' || !results?.[0]?.geometry?.location) {
                resolvingPlaceRef.current = false
                return
              }
              const g = results[0].geometry.location
              commitResolved(
                g.lat(),
                g.lng(),
                results[0].formatted_address ?? hint
              )
            })
            return
          }
          resolvingPlaceRef.current = false
        }
      )
    }

    ac.addListener('place_changed', () => {
      cancelPendingClearGeocode()
      const place = ac.getPlace()
      resolvingPlaceRef.current = true
      suppressClearUntilRef.current = Date.now() + 20000

      const loc = place.geometry?.location
      const addrHint =
        place.formatted_address ?? place.name ?? input.value?.trim() ?? ''

      if (place.place_id) {
        fetchDetailsAndCommit(place.place_id, place)
        return
      }

      if (!loc && addrHint) {
        suppressClearUntilRef.current = Date.now() + 15000
        const geocoder = new google.maps.Geocoder()
        geocoder.geocode({ address: addrHint }, (results, status) => {
          if (status !== 'OK' || !results?.[0]?.geometry?.location) {
            resolvingPlaceRef.current = false
            return
          }
          const g = results[0].geometry.location
          const formatted =
            results[0].formatted_address ?? addrHint
          commitResolved(g.lat(), g.lng(), formatted)
        })
        return
      }

      if (!loc) {
        resolvingPlaceRef.current = false
        return
      }

      commitResolved(
        loc.lat(),
        loc.lng(),
        place.formatted_address ?? place.name ?? input.value
      )
    })

    acRef.current = ac
  }, [cancelPendingClearGeocode, onAddressChange, onPlaceResolved])

  useEffect(() => {
    if (!apiKey || disabled) return

    const w = window as Window & { gm_authFailure?: () => void }
    const previousGmAuthFailure = w.gm_authFailure
    const wrapped = () => {
      onAuthFailure?.()
      try {
        previousGmAuthFailure?.()
      } catch {
        /* ignore */
      }
    }
    w.gm_authFailure = wrapped

    if (window.google?.maps?.places) {
      attach()
      return () => {
        cancelPendingClearGeocode()
        if (w.gm_authFailure === wrapped) w.gm_authFailure = previousGmAuthFailure
        if (acRef.current) {
          google.maps.event.clearInstanceListeners(acRef.current)
          acRef.current = null
        }
      }
    }

    const id = 'google-maps-js'
    if (document.getElementById(id)) {
      const t = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(t)
          attach()
        }
      }, 100)
      return () => {
        cancelPendingClearGeocode()
        clearInterval(t)
        if (w.gm_authFailure === wrapped) w.gm_authFailure = previousGmAuthFailure
        if (acRef.current) {
          google.maps.event.clearInstanceListeners(acRef.current)
          acRef.current = null
        }
      }
    }

    const script = document.createElement('script')
    script.id = id
    script.async = true
    // Do not use loading=async without a callback= init — that can partially load Places
    // (suggestions) while triggering "This page can't load Google Maps correctly."
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`
    script.onload = () => attach()
    document.head.appendChild(script)

    return () => {
      cancelPendingClearGeocode()
      if (w.gm_authFailure === wrapped) w.gm_authFailure = previousGmAuthFailure
      if (acRef.current) {
        google.maps.event.clearInstanceListeners(acRef.current)
        acRef.current = null
      }
    }
  }, [apiKey, disabled, attach, onAuthFailure])

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
          if (resolvingPlaceRef.current) return
          if (Date.now() < suppressClearUntilRef.current) return
          const committed = lastCommittedFormattedRef.current
          if (
            committed &&
            normalizeAddress(v) === normalizeAddress(committed)
          ) {
            return
          }
          cancelPendingClearGeocode()
          pendingClearTimeoutRef.current = setTimeout(() => {
            pendingClearTimeoutRef.current = null
            if (resolvingPlaceRef.current) return
            if (Date.now() < suppressClearUntilRef.current) return
            const v2 = inputRef.current?.value ?? ''
            const c = lastCommittedFormattedRef.current
            if (c && normalizeAddress(v2) === normalizeAddress(c)) return
            onClearGeocode()
          }, CLEAR_GEOCODE_DEBOUNCE_MS)
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
