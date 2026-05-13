import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { CATEGORY_ENUM } from '@/constants/categories'
import { z } from 'zod'
import { addWeeks } from 'date-fns'
import { syncVendorSessionToExternalCalendars } from '@/lib/vendor-calendar-sync'
import {
  buildSeriesOccurrencesFromDateIsos,
  expandSessionsForCalendarRange,
} from '@/lib/workshop-series'

const multiWeekOccurrenceSchema = z.number().int().min(2).max(12)

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
  cover_image_url: z.string().url().optional().nullable(),
  workshop_series: z.enum(['one_day', 'multi_week']).default('one_day'),
  multi_week_occurrence_count: multiWeekOccurrenceSchema.optional(),
  multi_week_schedule: z.enum(['same_day_time', 'custom_times']).optional(),
  multi_week_additional_datetimes: z.array(z.string()).max(11).optional(),
})

function parseUserDateTime(s: string): Date | null {
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * One DB row per workshop: multi-week is stored as `workshop_series: multi_week` + `series_occurrences`.
 * Infer multi-week when the client omits `workshop_series` (Zod would default to `one_day`) but sends
 * a full recurring payload — avoids a single-date insert and duplicate weekly rows from retries.
 */
function inferSeriesKind(body: z.infer<typeof sessionSchema>): 'one_day' | 'multi_week' {
  if (body.workshop_series === 'multi_week') return 'multi_week'
  if (
    typeof body.multi_week_occurrence_count === 'number' &&
    body.multi_week_occurrence_count > 1 &&
    body.multi_week_schedule
  ) {
    return 'multi_week'
  }
  return 'one_day'
}

/** ISO strings for each weekly occurrence (sorted ascending for custom). */
function resolveWorkshopSeriesDates(body: z.infer<typeof sessionSchema>): { ok: true; dates: string[] } | { ok: false; error: string } {
  const series = inferSeriesKind(body)
  if (series === 'one_day') {
    if (!body.date?.trim()) return { ok: true, dates: [] }
    const first = parseUserDateTime(body.date)
    if (!first) return { ok: false, error: 'Invalid date & time for the workshop.' }
    return { ok: true, dates: [first.toISOString()] }
  }

  if (!body.date?.trim()) {
    return { ok: false, error: 'Set the first workshop date & time for a recurring series.' }
  }
  const first = parseUserDateTime(body.date)
  if (!first) return { ok: false, error: 'Invalid date & time for the first workshop.' }

  const count = body.multi_week_occurrence_count
  if (!count) return { ok: false, error: 'Choose how many weeks this recurring workshop runs.' }
  const schedule = body.multi_week_schedule
  if (!schedule) return { ok: false, error: 'Choose whether follow-up dates match each week or are set manually.' }

  if (schedule === 'same_day_time') {
    const dates = Array.from({ length: count }, (_, i) => addWeeks(first, i).toISOString())
    return { ok: true, dates }
  }

  const extras = body.multi_week_additional_datetimes ?? []
  const need = count - 1
  if (extras.length !== need) {
    return { ok: false, error: `Enter date & time for every additional session (${need} after the first).` }
  }
  const parsedExtras = extras.map((raw) => parseUserDateTime(raw))
  if (parsedExtras.some((d) => !d)) {
    return { ok: false, error: 'One or more additional session dates are invalid.' }
  }
  const all = [first, ...parsedExtras.map((d) => d!)]
  const iso = all.map((d) => d.toISOString())
  iso.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  return { ok: true, dates: iso }
}

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
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const excludeArchived = searchParams.get('exclude_archived') !== '0'
    const calendarRange = Boolean(from && to)

    let query = admin.from('events').select('*').eq('vendor_profile_id', vendor.id)

    if (status) {
      query = query.eq('booking_status', status)
    }
    if (calendarRange && from && to) {
      // Include multi-week series rows even when the first session is before `from`
      // (later weeks still appear on the calendar after expansion).
      query = query.or(
        `workshop_series.eq.multi_week,and(date.gte.${from},date.lte.${to})`
      )
    } else {
      if (from) {
        query = query.gte('date', from)
      }
      if (to) {
        query = query.lte('date', to)
      }
    }
    if (excludeArchived) {
      query = query.neq('booking_status', 'archived')
    }

    query = calendarRange
      ? query.order('date', { ascending: true, nullsFirst: false })
      : query.order('created_at', { ascending: false })

    const { data: sessions, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let rows = sessions ?? []
    if (calendarRange && from && to) {
      rows = expandSessionsForCalendarRange(rows as Parameters<typeof expandSessionsForCalendarRange>[0], from, to)
    }

    const withStatusAlias = rows.map((row) => ({
      ...row,
      status: (row as { booking_status?: string }).booking_status as string | undefined,
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
      .select('id, default_workshop_image_url')
      .eq('user_id', user.id)
      .single()

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    const resolvedImageUrl =
      body.cover_image_url != null && body.cover_image_url !== ''
        ? body.cover_image_url
        : (vendor.default_workshop_image_url as string | null) ?? null

    const resolvedDates = resolveWorkshopSeriesDates(body)
    if (!resolvedDates.ok) {
      return NextResponse.json({ error: resolvedDates.error }, { status: 400 })
    }

    const baseRow = {
      title: body.title,
      vendor_profile_id: vendor.id,
      category: body.category,
      price: body.price_cad > 0 ? `$${body.price_cad} CAD` : 'Free',
      price_cad: body.price_cad,
      max_attendees: body.max_attendees,
      available_slots: body.max_attendees,
      duration_minutes: body.duration_minutes,
      location: body.location_address ?? body.location_link ?? null,
      booking_status: body.status,
      description: body.description ?? null,
      organizer: null,
      image_url: resolvedImageUrl,
    }

    const dateIsos = resolvedDates.dates
    const isMultiWeek = dateIsos.length > 1
    const seriesOcc = isMultiWeek ? buildSeriesOccurrencesFromDateIsos(dateIsos, body.max_attendees) : null
    const sumAvail = seriesOcc ? seriesOcc.reduce((a, o) => a + o.available_slots, 0) : body.max_attendees
    const sumMax = seriesOcc ? seriesOcc.reduce((a, o) => a + o.max_attendees, 0) : body.max_attendees

    const insertRow =
      dateIsos.length === 0
        ? {
            ...baseRow,
            date: null as string | null,
            workshop_series: 'one_day' as const,
            series_occurrences: null,
          }
        : {
            ...baseRow,
            date: dateIsos[0],
            workshop_series: isMultiWeek ? ('multi_week' as const) : ('one_day' as const),
            series_occurrences: seriesOcc,
            available_slots: sumAvail,
            max_attendees: sumMax,
          }

    const { data: created, error: insertError } = await admin.from('events').insert(insertRow).select().single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Mark first_session_created if this is the first
    await admin
      .from('vendor_profiles')
      .update({ first_session_created: true })
      .eq('id', vendor.id)
      .eq('first_session_created', false)

    if (created?.id) {
      void syncVendorSessionToExternalCalendars(admin, vendor.id, String(created.id)).catch((e) =>
        console.error('[sessions] calendar sync', e)
      )
    }

    const row = { ...created, status: created.booking_status }

    return NextResponse.json(
      {
        sessions: [row],
        session: row,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Session create error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
