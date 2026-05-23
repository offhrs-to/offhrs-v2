'use server'

import * as cheerio from 'cheerio'

interface MetadataResult {
  title: string | null
  description: string | null
  image: string | null
  date: string | null
  location: string | null
  organizer: string | null
}

export async function fetchUrlMetadata(url: string): Promise<MetadataResult> {
  const result: MetadataResult = {
    title: null,
    description: null,
    image: null,
    date: null,
    location: null,
    organizer: null,
  }

  try {
    // Fetch the HTML content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Strategy 1: JSON-LD (best for Eventbrite/Luma)
    const jsonLdScripts = $('script[type="application/ld+json"]')
    
    if (jsonLdScripts.length > 0) {
      for (let i = 0; i < jsonLdScripts.length; i++) {
        try {
          const jsonLdText = $(jsonLdScripts[i]).html()
          if (!jsonLdText) continue

          const jsonLd = JSON.parse(jsonLdText)
          
          // Handle both single objects and arrays
          const data = Array.isArray(jsonLd) ? jsonLd[0] : jsonLd
          
          // Extract from Event schema
          if (data['@type'] === 'Event' || data.type === 'Event') {
            // Title
            if (!result.title && (data.name || data.title)) {
              result.title = data.name || data.title
            }

            // Description
            if (!result.description && (data.description || data.about)) {
              result.description = typeof data.description === 'string' 
                ? data.description 
                : data.about?.description || null
            }

            // Image
            if (!result.image) {
              if (data.image) {
                result.image = typeof data.image === 'string' 
                  ? data.image 
                  : data.image.url || data.image[0]?.url || null
              }
            }

            // Date (startDate)
            if (!result.date && data.startDate) {
              const startDate = new Date(data.startDate)
              if (!isNaN(startDate.getTime())) {
                // Format for datetime-local input: YYYY-MM-DDTHH:mm
                const year = startDate.getFullYear()
                const month = String(startDate.getMonth() + 1).padStart(2, '0')
                const day = String(startDate.getDate()).padStart(2, '0')
                const hours = String(startDate.getHours()).padStart(2, '0')
                const minutes = String(startDate.getMinutes()).padStart(2, '0')
                result.date = `${year}-${month}-${day}T${hours}:${minutes}`
              }
            }

            // Location
            if (!result.location) {
              if (data.location) {
                if (typeof data.location === 'string') {
                  result.location = data.location
                } else if (data.location.name) {
                  result.location = data.location.name
                } else if (data.location.address) {
                  const addr = data.location.address
                  const parts = [
                    addr.streetAddress,
                    addr.addressLocality,
                    addr.addressRegion,
                    addr.postalCode,
                  ].filter(Boolean)
                  result.location = parts.join(', ')
                }
              }
            }

            // Organizer
            if (!result.organizer && data.organizer) {
              if (typeof data.organizer === 'string') {
                result.organizer = data.organizer
              } else if (data.organizer.name) {
                result.organizer = data.organizer.name
              }
            }

            // If we found everything, return early
            if (result.title && result.image && result.date) {
              return result
            }
          }
        } catch (e) {
          // Continue to next JSON-LD script or fallback
          console.error('Error parsing JSON-LD:', e)
        }
      }
    }

    // Strategy 2: Open Graph meta tags
    if (!result.title) {
      result.title = $('meta[property="og:title"]').attr('content') || null
    }

    if (!result.description) {
      result.description = 
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        null
    }

    if (!result.image) {
      result.image = 
        $('meta[property="og:image"]').attr('content') ||
        $('meta[name="og:image"]').attr('content') ||
        null
      
      // Clean up image URL (remove query params if needed)
      if (result.image) {
        result.image = result.image.split('?')[0]
      }
    }

    // Strategy 3: Fallback to basic HTML tags
    if (!result.title) {
      result.title = $('title').text().trim() || null
    }

    if (!result.image) {
      const firstImage = $('img').first()
      if (firstImage.length) {
        const imgSrc = firstImage.attr('src') || firstImage.attr('data-src')
        if (imgSrc) {
          // Handle relative URLs
          try {
            const baseUrl = new URL(url)
            result.image = new URL(imgSrc, baseUrl.origin).href
          } catch {
            result.image = imgSrc
          }
        }
      }
    }

    return result
  } catch (error) {
    console.error('Error fetching metadata:', error)
    throw new Error('Failed to fetch metadata from URL')
  }
}

