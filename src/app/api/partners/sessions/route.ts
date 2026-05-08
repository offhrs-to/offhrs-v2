import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { createCalEventType } from '@/lib/cal'
import { decrypt } from '@/lib/token-encryption'
import { z } from 'zod'

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

const sessionSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  category: z.enum(['pottery', 'floral', 'culinary', 'other']),
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
      query = query.eq('status', status)
    }

    const { data: sessions, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ sessions })
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
      .select('id, cal_user_id')
      .eq('user_id', user.id)
      .single()

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    // Build Cal.com locations
    const locations: { type: string; address?: string; link?: string }[] = []
    if (body.location_type === 'in_person' && body.location_address) {
      locations.push({ type: 'inPerson', address: body.location_address })
    } else if (body.location_type === 'virtual' && body.location_link) {
      locations.push({ type: 'link', link: body.location_link })
    }

    // Sync to Cal.com if vendor has a managed user
    let calEventTypeId: string | null = null

    if (vendor.cal_user_id) {
      const { data: tokenRow } = await admin
        .from('vendor_cal_tokens')
        .select('access_token')
        .eq('vendor_id', vendor.id)
        .single()

      if (tokenRow) {
        try {
          const accessToken = decrypt(tokenRow.access_token)
          const calEventType = await createCalEventType(accessToken, {
            title: body.title,
            slug: slugify(body.title),
            lengthInMinutes: body.duration_minutes,
            description: body.description,
            price: body.price_cad > 0 ? Math.round(body.price_cad * 100) : undefined,
            currency: 'cad',
            seatsPerTimeSlot: body.max_attendees,
            locations: locations.length > 0 ? locations : undefined,
          })
          calEventTypeId = String(calEventType.id ?? calEventType.eventTypeId)
        } catch (calErr) {
          console.error('Cal.com event type creation failed (non-fatal):', calErr)
        }
      }
    }

    // Insert into events table
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
        status: body.status,
        cal_event_type_id: calEventTypeId,
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

    return NextResponse.json({ session: event }, { status: 201 })
  } catch (err) {
    console.error('Session create error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

