'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X, MapPin, Loader2 } from 'lucide-react'

const categories = [
  'All',
  'Pottery',
  'Coffee',
  'Florals',
  'Jewelry',
  'Wellness',
  'Culinary',
  'Other',
]

interface SearchToolbarProps {
  onLocationChange?: (center: [number, number] | null) => void
}

export default function SearchToolbar({ onLocationChange }: SearchToolbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const [query, setQuery] = useState(searchParams.get('query') || '')
  const [category, setCategory] = useState(searchParams.get('category') || 'All')
  const [locationInput, setLocationInput] = useState('')
  const [geocodingLocation, setGeocodingLocation] = useState(false)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Update URL with search params
  const updateSearchParams = (newQuery: string, newCategory: string) => {
    const params = new URLSearchParams()
    
    if (newQuery.trim()) {
      params.set('query', newQuery.trim())
    }
    
    if (newCategory && newCategory !== 'All') {
      params.set('category', newCategory)
    }
    
    const queryString = params.toString()
    const url = queryString ? `${pathname}?${queryString}` : pathname
    router.push(url)
  }

  // Handle query input change with debounce
  const handleQueryChange = (value: string) => {
    setQuery(value)
    
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    
    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      updateSearchParams(value, category)
    }, 300)
  }

  // Handle category change (immediate, no debounce)
  const handleCategoryChange = (value: string) => {
    setCategory(value)
    // Clear any pending query debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    updateSearchParams(query, value)
  }

  // Handle location geocoding
  const handleLocationGeocode = async () => {
    const location = locationInput.trim()
    
    if (!location) {
      if (onLocationChange) {
        onLocationChange(null)
      }
      return
    }

    setGeocodingLocation(true)

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`,
        {
          headers: {
            'User-Agent': 'Offhrs-App',
          },
        }
      )

      if (!response.ok) {
        throw new Error('Geocoding request failed')
      }

      const data = await response.json()

      if (data && data.length > 0) {
        const firstResult = data[0]
        const lat = parseFloat(firstResult.lat)
        const lon = parseFloat(firstResult.lon)
        
        if (onLocationChange) {
          onLocationChange([lat, lon])
        }
      } else {
        if (onLocationChange) {
          onLocationChange(null)
        }
      }
    } catch (err) {
      console.error('Error geocoding location:', err)
      if (onLocationChange) {
        onLocationChange(null)
      }
    } finally {
      setGeocodingLocation(false)
    }
  }

  // Reset filters
  const handleReset = () => {
    setQuery('')
    setCategory('All')
    setLocationInput('')
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    if (onLocationChange) {
      onLocationChange(null)
    }
    router.push(pathname)
  }

  // Sync with URL changes (e.g., browser back/forward)
  useEffect(() => {
    setQuery(searchParams.get('query') || '')
    setCategory(searchParams.get('category') || 'All')
  }, [searchParams])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  const hasActiveFilters = query || (category && category !== 'All') || locationInput

  return (
    <div className="mb-8 space-y-4">
      {/* First Row: Search and Category */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search workshops by name..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="pl-10 focus-visible:border-moss focus-visible:ring-moss/50"
          />
        </div>

        {/* Category Select */}
        <div className="md:w-48">
          <Select value={category} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full focus-visible:border-moss focus-visible:ring-moss/50">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Second Row: Location and Reset */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Location Input */}
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Enter location to center map (e.g., Toronto, ON)"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onBlur={handleLocationGeocode}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleLocationGeocode()
              }
            }}
            className="pl-10 pr-10 focus-visible:border-moss focus-visible:ring-moss/50"
            disabled={geocodingLocation}
          />
          {geocodingLocation && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            </div>
          )}
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={handleReset}
            className="md:w-auto w-full text-slate-600 hover:text-slate-900"
          >
            <X className="h-4 w-4 mr-2" />
            Reset
          </Button>
        )}
      </div>
    </div>
  )
}
