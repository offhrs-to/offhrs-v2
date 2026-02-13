import { scrapeBodySchema } from '@/lib/api-validation'
import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(request: Request) {
  try {
    const raw = await request.json()
    if (typeof raw !== 'object' || raw === null) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }
    const parsed = scrapeBodySchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? 'URL is required and must be valid'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const { url } = parsed.data

    // 1. Fetch the website content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    const html = await response.text()
    const $ = cheerio.load(html)

    // 2. Initialize Data
    let title = $('meta[property="og:title"]').attr('content') || $('title').text() || ''
    let description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || ''
    let image_url = $('meta[property="og:image"]').attr('content') || ''
    let price = ''
    let date = ''
    let location = ''

    // 3. Search for JSON-LD (Structured Data)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}')
        
        // Check if it's an Event
        if (json['@type'] === 'Event' || json['@type'] === 'EducationEvent') {
          if (json.name) title = json.name
          if (json.image) image_url = Array.isArray(json.image) ? json.image[0] : json.image
          if (json.description) description = json.description
          if (json.startDate) date = json.startDate
          
          if (json.location && json.location.name) {
             location = json.location.name
             if (json.location.address && json.location.address.streetAddress) {
               location += `, ${json.location.address.streetAddress}`
             }
          }

          if (json.offers) {
            const offer = Array.isArray(json.offers) ? json.offers[0] : json.offers
            if (offer.price) price = offer.price
          }
        }
      } catch (e) {
        // Ignore bad JSON
      }
    })

    // 4. Fallback Price Search
    if (!price) {
      const priceMatch = html.match(/\$\s?(\d+(\.\d{2})?)/)
      if (priceMatch) price = priceMatch[1]
    }

    // Clean up Title
    title = title.split('|')[0].trim()

    return NextResponse.json({
      title,
      description,
      image_url,
      date,
      location,
      price,
      external_link: url
    })

  } catch (error) {
    console.error('Scrape Error:', error)
    return NextResponse.json({ error: 'Failed to fetch link' }, { status: 500 })
  }
}