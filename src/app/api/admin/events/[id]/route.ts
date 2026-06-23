import { verifyAdmin } from '@/lib/admin-auth'
import { deleteAdminEvent, updateAdminEvent, type AdminEventInput } from '@/lib/admin-events'
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

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params

  try {
    const parsed = adminEventSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    await updateAdminEvent(id, parsed.data as AdminEventInput)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update event'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params

  try {
    await deleteAdminEvent(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete event'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
