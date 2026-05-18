'use server'

import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'
import { parseWorkshopDateTimeInput } from '@/lib/workshop-timezone'

export async function deleteEvent(id: string) {
  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(error.message)
    }

    // Revalidate paths to refresh cached data
    revalidatePath('/')
    revalidatePath('/admin')

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting event:', error)
    throw new Error(error.message || 'Failed to delete event')
  }
}

export async function updateEvent(id: string, data: {
  title: string
  category: string | null
  price: string | null
  date: string | null
  location: string | null
  organizer: string | null
  image_url: string | null
  external_link: string | null
  lat: string | number | null
  lng: string | number | null
  is_multiple_dates: boolean
  duration_weeks: number | null
  recurrence?: 'none' | 'daily' | 'weekly'
}) {
  try {
    // Handle lat/lng - convert to number or null
    let lat: number | null = null
    let lng: number | null = null

    if (data.lat !== null && data.lat !== undefined && data.lat !== '') {
      if (typeof data.lat === 'string') {
        const trimmed = data.lat.trim()
        lat = trimmed ? parseFloat(trimmed) : null
      } else if (typeof data.lat === 'number') {
        lat = data.lat
      }
      // Check if parsing resulted in NaN
      if (lat !== null && isNaN(lat)) {
        lat = null
      }
    }

    if (data.lng !== null && data.lng !== undefined && data.lng !== '') {
      if (typeof data.lng === 'string') {
        const trimmed = data.lng.trim()
        lng = trimmed ? parseFloat(trimmed) : null
      } else if (typeof data.lng === 'number') {
        lng = data.lng
      }
      // Check if parsing resulted in NaN
      if (lng !== null && isNaN(lng)) {
        lng = null
      }
    }

    // Ensure date is stored as ISO string
    let formattedDate: string | null = null
    if (data.date) {
      const trimmedDate = data.date.trim()
      if (trimmedDate) {
        // If it's in datetime-local format (YYYY-MM-DDTHH:mm), convert to ISO
        if (trimmedDate.includes('T') && !trimmedDate.includes('Z') && trimmedDate.length === 16) {
          const date = parseWorkshopDateTimeInput(trimmedDate)
          if (date) {
            formattedDate = date.toISOString()
          } else {
            formattedDate = trimmedDate
          }
        } else {
          formattedDate = trimmedDate
        }
      }
    }

    const { error } = await supabase
      .from('events')
      .update({
        title: data.title.trim(),
        category: data.category?.trim() || null,
        price: data.price?.trim() || null,
        date: formattedDate,
        location: data.location?.trim() || null,
        organizer: data.organizer?.trim() || null,
        image_url: data.image_url?.trim() || null,
        external_link: data.external_link?.trim() || null,
        lat: lat,
        lng: lng,
        is_multiple_dates: data.is_multiple_dates,
        duration_weeks: data.duration_weeks != null ? Math.max(1, data.duration_weeks) : null,
        recurrence: data.recurrence ?? 'none',
      })
      .eq('id', id)

    if (error) {
      throw new Error(error.message)
    }

    // Revalidate paths to refresh cached data
    revalidatePath('/')
    revalidatePath('/admin')

    return { success: true }
  } catch (error: any) {
    console.error('Error updating event:', error)
    throw new Error(error.message || 'Failed to update event')
  }
}

