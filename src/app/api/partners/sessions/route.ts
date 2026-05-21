import { repairOrphanedStripeRefundsForVendor } from '@/lib/booking-refund'
import { reconcileVendorEventSlots } from '@/lib/event-slot-reconcile'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { CATEGORY_ENUM } from '@/constants/categories'
import { z } from 'zod'
import { syncVendorSessionToExternalCalendars } from '@/lib/vendor-calendar-sync'
import {
  applyCohortAvailability,
  buildSeriesOccurrencesFromDateIsos,
  expandSessionsForCalendarRange,
} from '@/lib/workshop-series'
import { LITE_MAX_WORKSHOP_SESSIONS_PER_BILLING_PERIOD } from '@/lib/stripe-partner-plans'
import { buildPartnerSeriesMeta, resolveWorkshopSeriesDates } from '@/lib/partner-session-series-resolve'
import { setSeriesAvailabilityFromRules } from '@/lib/partner-event-availability'
import { resolveEventCoordinates } from '@/lib/event-location-coordinates'

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
  location_lat: z.number().finite().optional().nullable(),
  location_lng: z.number().finite().optional().nullable(),
  location_link: z.string().url().optional(),
  status: z.enum(['published', 'draft']).default('published'),
  cover_image_url: z.string().url().optional().nullable(),
  workshop_series: z.enum(['one_day', 'multi_week']).default('one_day'),
  multi_week_occurrence_count: multiWeekOccurrenceSchema.optional(),
  multi_week_schedule: z.enum(['same_day_time', 'custom_times', 'daily_weekdays']).optional(),
  multi_week_additional_datetimes: z.array(z.string()).max(11).optional(),
  multi_week_daily_js_weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  external_booked_count: z.number().int().min(0).max(500).optional().default(0),
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

    await repairOrphanedStripeRefundsForVendor(admin, vendor.id)
    await reconcileVendorEventSlots(admin, vendor.id)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const excludeArchived = searchParams.get('exclude_archived') !== '0'
    const calendarRange = Boolean(from && to)

    let query = admin.from('events').select('*').eq('vendor_profile_id', vendor.id)

    if (status) {
      query = query.eq('booking_status', status)
    } else if (excludeArchived) {
      // Default list (e.g. "All") hides archived; do not combine with status=archived filter.
      query = query.neq('booking_status', 'archived')
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
      .select('id, business_name, default_workshop_image_url')
      .eq('user_id', user.id)
      .single()

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    const { data: activeSub } = await admin
      .from('vendor_subscriptions')
      .select('subscription_tier, current_period_start, current_period_end, status')
      .eq('vendor_id', vendor.id)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeSub?.subscription_tier === 'lite') {
      // Lite is capped at N concurrently active workshops. Archived rows do
      // not count, so vendors can free a slot by archiving and try again.
      const { count, error: countError } = await admin
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_profile_id', vendor.id)
        .neq('booking_status', 'archived')

      if (countError) {
        console.error('[sessions] Lite quota count', countError)
      } else if (
        count != null &&
        count >= LITE_MAX_WORKSHOP_SESSIONS_PER_BILLING_PERIOD
      ) {
        return NextResponse.json(
          {
            error: `Lite plan supports up to ${LITE_MAX_WORKSHOP_SESSIONS_PER_BILLING_PERIOD} active workshops at a time. Archive one you no longer need, or upgrade to Pro for unlimited workshops.`,
          },
          { status: 403 }
        )
      }
    }

    const extRaw = body.external_booked_count ?? 0
    if (extRaw > body.max_attendees) {
      return NextResponse.json(
        { error: 'Spots booked elsewhere cannot exceed max spots (per session date).' },
        { status: 400 }
      )
    }

    const resolvedDates = resolveWorkshopSeriesDates(body)
    if (!resolvedDates.ok) {
      return NextResponse.json({ error: resolvedDates.error }, { status: 400 })
    }

    const meta = buildPartnerSeriesMeta({
      date: body.date,
      workshop_series: body.workshop_series,
      multi_week_occurrence_count: body.multi_week_occurrence_count,
      multi_week_schedule: body.multi_week_schedule,
      multi_week_additional_datetimes: body.multi_week_additional_datetimes,
      multi_week_daily_js_weekdays: body.multi_week_daily_js_weekdays,
    })

    const resolvedImageUrl =
      body.cover_image_url != null && body.cover_image_url !== ''
        ? body.cover_image_url
        : (vendor.default_workshop_image_url as string | null) ?? null

    const locationText =
      body.location_type === 'virtual'
        ? (body.location_link ?? null)
        : (body.location_address ?? null)

    const { lat, lng } = await resolveEventCoordinates({
      location: locationText,
      locationType: body.location_type,
      clientLat: body.location_lat,
      clientLng: body.location_lng,
    })

    const baseRow = {
      title: body.title,
      vendor_profile_id: vendor.id,
      category: body.category,
      price: body.price_cad > 0 ? `$${body.price_cad} CAD` : 'Free',
      price_cad: body.price_cad,
      max_attendees: body.max_attendees,
      duration_minutes: body.duration_minutes,
      location: locationText,
      lat,
      lng,
      booking_status: body.status,
      description: body.description ?? null,
      organizer: vendor.business_name?.trim() || null,
      image_url: resolvedImageUrl,
      external_booked_count: extRaw,
      partner_series_meta: meta,
    }

    const dateIsos = resolvedDates.dates
    const isMultiWeek = dateIsos.length > 1
    const isCohort =
      isMultiWeek && (meta?.pattern === 'weekly_same' || meta?.pattern === 'weekly_custom')
    let seriesOcc = isMultiWeek ? buildSeriesOccurrencesFromDateIsos(dateIsos, body.max_attendees) : null

    let topMax = body.max_attendees
    let topAvail = Math.max(0, body.max_attendees - extRaw)

    if (seriesOcc) {
      if (isCohort) {
        seriesOcc = applyCohortAvailability(seriesOcc, body.max_attendees, topAvail)
        topMax = body.max_attendees
      } else {
        const bookedZeros = seriesOcc.map(() => 0)
        seriesOcc = setSeriesAvailabilityFromRules(seriesOcc, extRaw, bookedZeros)
        topAvail = seriesOcc.reduce((a, o) => a + o.available_slots, 0)
        topMax = seriesOcc.reduce((a, o) => a + o.max_attendees, 0)
      }
    }

    const insertRow =
      dateIsos.length === 0
        ? {
            ...baseRow,
            date: null as string | null,
            workshop_series: 'one_day' as const,
            series_occurrences: null,
            available_slots: Math.max(0, body.max_attendees - extRaw),
          }
        : {
            ...baseRow,
            date: dateIsos[0],
            workshop_series: isMultiWeek ? ('multi_week' as const) : ('one_day' as const),
            series_occurrences: seriesOcc,
            available_slots: topAvail,
            max_attendees: topMax,
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
