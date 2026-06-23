import { verifyAdmin } from '@/lib/admin-auth'
import { insertAdminEvents, type AdminEventInput } from '@/lib/admin-events'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const adminEventSchema = z.object({
  title: z.string().min(1),
  category: z.string().nullable(),
  price: z.string().nullable(),
  date: z.string().nullable(),
  location: z.string().nullable(),
  organizer: z.string().nullable(),
  image_url: z.string().nullable(),
  external_link: z.string().nullable(),
  lat: z.union([z.string(), z.number()]).nullable(),
  lng: z.union([z.string(), z.number()]).nullable(),
  is_multiple_dates: z.boolean(),
  duration_weeks: z.number().nullable(),
  duration_minutes: z.number().nullable(),
  description: z.string().nullable(),
  recurrence: z.enum(['none', 'daily', 'weekly']).optional(),
  vendor_profile_id: z.string().uuid().nullable().optional(),
})

const bodySchema = z.object({
  rows: z.array(adminEventSchema).min(1),
})

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    await insertAdminEvents(parsed.data.rows as AdminEventInput[])
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to insert events'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
