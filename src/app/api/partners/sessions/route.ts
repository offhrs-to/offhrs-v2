import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { CATEGORY_ENUM } from '@/constants/categories'
import { z } from 'zod'

const sessionSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  category: z.enum(CATEGORY_ENUM),
  price_cad: z.number().min(0).max(10000),
  max_attendees: z.number().int().min(1).max(500),
  duration_minutes: z.number().int().min(15).max(480),
  date: z.string().optional(),
  location_type: z.enum(['in_person', 'virtual']),
  location_address: z.string().max(500).optional(),
  location_link: z.string().url().optional(),
  status: z.enum(['published', 'draft']).default('published'),
})

// GET /api/partners/sessions — list vendor sessions
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = admin
      .from('events')
      .select('*')
      .eq('vendor_profile_id', vendor.id)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('booking_status', status)
    }

    const { data: sessions, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const withStatusAlias = (sessions ?? []).map((row) => ({
      ...row,
      status: row.booking_status as string | undefined,
    }))

    return NextResponse.json({ sessions: withStatusAlias })
  } catch (err) {
    console.error('Sessions list error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/partners/sessions — create a new session
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const raw = await request.json()
    const parsed = sessionSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', fields: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const body = parsed.data

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    // Insert into events table (first-party scheduling — date/time on the event row)
    const { data: event, error: insertError } = await admin
      .from('events')
      .insert({
        title: body.title,
        vendor_profile_id: vendor.id,
        category: body.category,
        price: body.price_cad > 0 ? `$${body.price_cad} CAD` : 'Free',
        price_cad: body.price_cad,
        max_attendees: body.max_attendees,
        available_slots: body.max_attendees,
        duration_minutes: body.duration_minutes,
        location: body.location_address ?? body.location_link ?? null,
        date: body.date ? new Date(body.date).toISOString() : null,
        booking_status: body.status,
        cal_event_type_id: null,
        organizer: null,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Mark first_session_created if this is the first
    await admin
      .from('vendor_profiles')
      .update({ first_session_created: true })
      .eq('id', vendor.id)
      .eq('first_session_created', false)

    return NextResponse.json({
      session: event ? { ...event, status: event.booking_status } : null,
    }, { status: 201 })
  } catch (err) {
    console.error('Session create error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
