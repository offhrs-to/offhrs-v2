'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminSession } from '@/lib/admin-auth-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseWorkshopDateTimeInput } from '@/lib/workshop-timezone'

export type AdminEventInput = {
  title: string
  mode?: string
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
  duration_minutes: number | null
  description: string | null
  recurrence?: 'none' | 'daily' | 'weekly'
}

function getAdminSupabase() {
  const admin = createAdminClient()
  if (!admin) {
    throw new Error('Server not configured with SUPABASE_SERVICE_ROLE_KEY')
  }
  return admin
}

function parseLatLng(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isNaN(value) ? null : value
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = parseFloat(trimmed)
  return Number.isNaN(parsed) ? null : parsed
}

function formatEventDate(date: string | null): string | null {
  if (!date) return null
  const trimmedDate = date.trim()
  if (!trimmedDate) return null
  if (trimmedDate.includes('T') && !trimmedDate.includes('Z') && trimmedDate.length === 16) {
    const parsed = parseWorkshopDateTimeInput(trimmedDate)
    return parsed ? parsed.toISOString() : trimmedDate
  }
  return trimmedDate
}

function normalizeEventRow(data: AdminEventInput) {
  return {
    title: data.title.trim(),
    mode: data.mode ?? 'craft',
    category: data.category?.trim() || null,
    price: data.price?.trim() || null,
    date: formatEventDate(data.date),
    location: data.location?.trim() || null,
    organizer: data.organizer?.trim() || null,
    image_url: data.image_url?.trim() || null,
    external_link: data.external_link?.trim() || null,
    lat: parseLatLng(data.lat),
    lng: parseLatLng(data.lng),
    is_multiple_dates: data.is_multiple_dates,
    duration_weeks: data.duration_weeks != null ? Math.max(1, data.duration_weeks) : null,
    duration_minutes:
      data.duration_minutes != null
        ? Math.min(480, Math.max(15, data.duration_minutes))
        : null,
    description: data.description?.trim() || null,
    recurrence: data.recurrence ?? 'none',
  }
}

function revalidateEventPaths() {
  revalidatePath('/')
  revalidatePath('/admin')
}

export async function insertEvents(rows: AdminEventInput[]) {
  await requireAdminSession()
  if (rows.length === 0) {
    throw new Error('No events to insert')
  }

  const admin = getAdminSupabase()
  const payload = rows.map(normalizeEventRow)
  const { error } = await admin.from('events').insert(payload)

  if (error) {
    throw new Error(error.message)
  }

  revalidateEventPaths()
  return { success: true }
}

export async function deleteEvent(id: string) {
  await requireAdminSession()

  const admin = getAdminSupabase()
  const { error } = await admin.from('events').delete().eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  revalidateEventPaths()
  return { success: true }
}

export async function updateEvent(id: string, data: AdminEventInput) {
  await requireAdminSession()

  const admin = getAdminSupabase()
  const { error } = await admin.from('events').update(normalizeEventRow(data)).eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  revalidateEventPaths()
  return { success: true }
}
