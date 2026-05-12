import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { CATEGORY_ENUM } from '@/constants/categories'
import { z } from 'zod'
import { syncVendorSessionToExternalCalendars } from '@/lib/vendor-calendar-sync'

const updateSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional(),
  category: z.enum(CATEGORY_ENUM).optional(),
  price_cad: z.number().min(0).max(10000).optional(),
  max_attendees: z.number().int().min(1).max(500).optional(),
  duration_minutes: z.number().int().min(15).max(480).optional(),
  date: z.string().optional(),
  location_type: z.enum(['in_person', 'virtual']).optional(),
  location_address: z.string().max(500).optional(),
  location_link: z.string().url().optional(),
  status: z.enum(['published', 'draft', 'archived']).optional(),
})

type Params = { params: Promise<{ id: string }> }

async function getVendorAndSession(userId: string, sessionId: string) {
  const admin = createAdminClient()
  if (!admin) return { admin: null, vendor: null, session: null }

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!vendor) return { admin, vendor: null, session: null }

  const { data: session } = await admin
    .from('events')
    .select('*')
    .eq('id', sessionId)
    .eq('vendor_profile_id', vendor.id)
    .single()

  return { admin, vendor, session }
}

// PUT /api/partners/sessions/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { admin, vendor, session } = await getVendorAndSession(user.id, id)
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const raw = await request.json()
    const parsed = updateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', fields: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const body = parsed.data

    const updatePayload: Record<string, unknown> = {}
    if (body.title !== undefined) updatePayload.title = body.title
    if (body.description !== undefined) updatePayload.description = body.description
    if (body.category !== undefined) updatePayload.category = body.category
    if (body.status !== undefined) updatePayload.booking_status = body.status
    if (body.price_cad !== undefined) {
      updatePayload.price_cad = body.price_cad
      updatePayload.price = body.price_cad > 0 ? `$${body.price_cad} CAD` : 'Free'
    }
    if (body.max_attendees !== undefined) updatePayload.max_attendees = body.max_attendees
    if (body.duration_minutes !== undefined) updatePayload.duration_minutes = body.duration_minutes
    if (body.date !== undefined) updatePayload.date = body.date ? new Date(body.date).toISOString() : null
    if (body.location_address !== undefined) updatePayload.location = body.location_address
    if (body.location_link !== undefined) updatePayload.location = body.location_link

    const { data: updated, error } = await admin
      .from('events')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (updated?.id) {
      void syncVendorSessionToExternalCalendars(admin, vendor.id, String(updated.id)).catch((e) =>
        console.error('[sessions] calendar sync', e)
      )
    }

    return NextResponse.json({
      session: updated ? { ...updated, status: updated.booking_status } : null,
    })
  } catch (err) {
    console.error('Session update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/partners/sessions/[id] — archive (soft delete)
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { admin, vendor, session } = await getVendorAndSession(user.id, id)
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    await admin.from('events').update({ booking_status: 'archived' }).eq('id', id)

    void syncVendorSessionToExternalCalendars(admin, vendor.id, id).catch((e) =>
      console.error('[sessions] calendar sync', e)
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Session delete error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
