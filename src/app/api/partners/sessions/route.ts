import { repairOrphanedStripeRefundsForVendor } from '@/lib/booking-refund'
import { reconcileVendorEventSlots } from '@/lib/event-slot-reconcile'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { CATEGORY_ENUM } from '@/constants/categories'
import { z } from 'zod'
import { scheduleVendorSessionCalendarSync } from '@/lib/vendor-calendar-sync'
import {
  applyCohortAvailability,
  buildSeriesOccurrencesFromDateIsos,
  expandSessionsForCalendarRange,
} from '@/lib/workshop-series'
import { LITE_MAX_WORKSHOP_SESSIONS_PER_BILLING_PERIOD } from '@/lib/stripe-partner-plans'
import { buildPartnerSeriesMeta, resolveWorkshopSeriesDates } from '@/lib/partner-session-series-resolve'
import { setSeriesAvailabilityFromRules } from '@/lib/partner-event-availability'
import { resolveEventCoordinates } from '@/lib/event-location-coordinates'
import { applyWorkshopRichTextFields } from '@/lib/workshop-rich-text'
import { normalizeSaleDateWindow, normalizeSalePriceCad, roundCadMoney, formatCadMoney } from '@/lib/workshop-ticket-price'
import { normalizeLocationUnit } from '@/lib/venue-address'

const multiWeekOccurrenceSchema = z.number().int().min(2).max(12)

// Dates are interpolated into a PostgREST `.or()` filter string below, so
// restrict them to a strict ISO date/datetime shape (no free-form filter syntax).
const dateFilterParamSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/)

const optionalWorkshopSectionText = z.string().max(6000).optional()

const sessionSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(6000).optional(),
  workshop_experience: optionalWorkshopSectionText,
  workshop_experience_hidden: z.boolean().optional(),
  workshop_materials_takeaway: optionalWorkshopSectionText,
  workshop_materials_takeaway_hidden: z.boolean().optional(),
  workshop_skill_level: optionalWorkshopSectionText,
  workshop_skill_level_hidden: z.boolean().optional(),
  category: z.enum(CATEGORY_ENUM),
  price_cad: z.number().min(0).max(10000),
  sale_price_cad: z.number().min(0).max(10000).nullable().optional(),
  sale_starts_on: z.string().nullable().optional(),
  sale_ends_on: z.string().nullable().optional(),
  max_attendees: z.number().int().min(1).max(500),
  duration_minutes: z.number().int().min(15).max(480),
  date: z.string().optional(),
  location_type: z.enum(['in_person', 'virtual']),
  location_address: z.string().max(500).optional(),
  location_unit: z.string().max(80).optional().nullable(),
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
  multi_week_daily_weeks: z.number().int().min(2).max(12).optional(),
  /** Extra HH:mm times on each selected weekday (daily_weekdays only). */
  multi_week_extra_session_times: z.array(z.string().max(8)).max(12).optional(),
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
    const rawFrom = searchParams.get('from')
    const rawTo = searchParams.get('to')
    const fromParsed = rawFrom ? dateFilterParamSchema.safeParse(rawFrom) : null
    const toParsed = rawTo ? dateFilterParamSchema.safeParse(rawTo) : null
    if ((rawFrom && !fromParsed?.success) || (rawTo && !toParsed?.success)) {
      return NextResponse.json({ error: 'Invalid from/to date' }, { status: 400 })
    }
    const from = fromParsed?.success ? fromParsed.data : null
    const to = toParsed?.success ? toParsed.data : null
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
      status:
        (row as { booking_status?: string | null; status?: string | null }).booking_status ??
        (row as { status?: string | null }).status ??
        undefined,
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
    let parsedBody: unknown
    try {
      parsedBody = applyWorkshopRichTextFields(raw)
    } catch (richTextErr) {
      const message = richTextErr instanceof Error ? richTextErr.message : 'Invalid description'
      return NextResponse.json({ error: message }, { status: 400 })
    }
    const parsed = sessionSchema.safeParse(parsedBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', fields: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const body = parsed.data

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select(
        'id, business_name, default_workshop_image_url, location_address, location_lat, location_lng'
      )
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

    // Native workshop creation requires Lite/Pro (Stripe). Shopify Sync is a separate plan.
    if (!activeSub || (activeSub.subscription_tier !== 'lite' && activeSub.subscription_tier !== 'pro')) {
      return NextResponse.json(
        {
          error:
            'Creating workshops in the dashboard requires an offhrs Lite or Pro plan. Shopify Sync alone only mirrors tagged products from your Shopify store.',
        },
        { status: 403 }
      )
    }

    if (activeSub.subscription_tier === 'lite') {
      // Lite is capped at N concurrently active workshops. Archived rows do
      // not count, so vendors can free a slot by archiving and try again.
      // Repeating-days create inserts one row per session — remaining-slot check
      // runs after dates are resolved (below).
      const { count, error: countError } = await admin
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_profile_id', vendor.id)
        .neq('booking_status', 'archived')

      if (countError) {
        console.error('[sessions] Lite quota count', countError)
      } else if (
        count != null &&
        count >= LITE_MAX_WORKSHOP_SESSIONS_PER_BILLING_PERIOD &&
        !(
          body.workshop_series === 'multi_week' &&
          body.multi_week_schedule === 'daily_weekdays'
        )
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
      multi_week_daily_weeks: body.multi_week_daily_weeks,
      multi_week_extra_session_times: body.multi_week_extra_session_times,
    })

    const resolvedImageUrl =
      body.cover_image_url != null && body.cover_image_url !== ''
        ? body.cover_image_url
        : (vendor.default_workshop_image_url as string | null) ?? null

    const locationText =
      body.location_type === 'virtual'
        ? (body.location_link ?? null)
        : (body.location_address ?? null)

    const locationUnit =
      body.location_type === 'virtual' ? null : normalizeLocationUnit(body.location_unit)

    const { lat, lng } = await resolveEventCoordinates({
      location: locationText,
      locationType: body.location_type,
      clientLat: body.location_lat,
      clientLng: body.location_lng,
      vendorProfileAddress: vendor.location_address as string | null,
      vendorProfileLat: vendor.location_lat as number | null,
      vendorProfileLng: vendor.location_lng as number | null,
    })

    let salePriceCad: number | null = null
    let saleStartsOn: string | null = null
    let saleEndsOn: string | null = null
    const listPriceCad = roundCadMoney(body.price_cad)
    try {
      salePriceCad = normalizeSalePriceCad(listPriceCad, body.sale_price_cad)
      const window = normalizeSaleDateWindow({
        hasSalePrice: salePriceCad != null,
        saleStartsOn: body.sale_starts_on,
        saleEndsOn: body.sale_ends_on,
      })
      saleStartsOn = window.sale_starts_on
      saleEndsOn = window.sale_ends_on
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Invalid sale price' },
        { status: 400 }
      )
    }

    const baseRow = {
      title: body.title,
      vendor_profile_id: vendor.id,
      category: body.category,
      price: listPriceCad > 0 ? `$${formatCadMoney(listPriceCad)} CAD` : 'Free',
      price_cad: listPriceCad,
      sale_price_cad: salePriceCad,
      sale_starts_on: saleStartsOn,
      sale_ends_on: saleEndsOn,
      max_attendees: body.max_attendees,
      duration_minutes: body.duration_minutes,
      location: locationText,
      location_unit: locationUnit,
      lat,
      lng,
      booking_status: body.status,
      description: body.description ?? null,
      workshop_experience: body.workshop_experience?.trim() || null,
      workshop_experience_hidden: body.workshop_experience_hidden ?? false,
      workshop_materials_takeaway: body.workshop_materials_takeaway?.trim() || null,
      workshop_materials_takeaway_hidden: body.workshop_materials_takeaway_hidden ?? false,
      workshop_skill_level: body.workshop_skill_level?.trim() || null,
      workshop_skill_level_hidden: body.workshop_skill_level_hidden ?? false,
      organizer: vendor.business_name?.trim() || null,
      image_url: resolvedImageUrl,
      external_booked_count: extRaw,
      partner_series_meta: meta,
    }

    const dateIsos = resolvedDates.dates
    const isDailyWeekdaysBatch =
      body.workshop_series === 'multi_week' &&
      body.multi_week_schedule === 'daily_weekdays' &&
      dateIsos.length >= 2

    // Repeating days: create one independent workshop listing per session start
    // (not a shared series_occurrences row). Weekly cohorts stay one multi_week row.
    // Existing daily_weekdays series created before this change are unchanged on edit.
    if (isDailyWeekdaysBatch) {
      const slotsNeeded = dateIsos.length
      if (activeSub?.subscription_tier === 'lite') {
        const { count, error: countError } = await admin
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('vendor_profile_id', vendor.id)
          .neq('booking_status', 'archived')

        if (countError) {
          console.error('[sessions] Lite quota recount for repeating days', countError)
        } else {
          const used = count ?? 0
          if (used + slotsNeeded > LITE_MAX_WORKSHOP_SESSIONS_PER_BILLING_PERIOD) {
            const remaining = Math.max(0, LITE_MAX_WORKSHOP_SESSIONS_PER_BILLING_PERIOD - used)
            return NextResponse.json(
              {
                error:
                  remaining === 0
                    ? `Lite plan supports up to ${LITE_MAX_WORKSHOP_SESSIONS_PER_BILLING_PERIOD} active workshops at a time. This schedule would create ${slotsNeeded} listings. Archive workshops you no longer need, reduce the schedule, or upgrade to Pro.`
                    : `Lite plan supports up to ${LITE_MAX_WORKSHOP_SESSIONS_PER_BILLING_PERIOD} active workshops (${remaining} slot${remaining === 1 ? '' : 's'} left). This schedule would create ${slotsNeeded} listings. Reduce days/weeks/times, archive existing workshops, or upgrade to Pro.`,
              },
              { status: 403 }
            )
          }
        }
      }

      const perAvail = Math.max(0, body.max_attendees - extRaw)
      const insertRows = dateIsos.map((startIso) => ({
        ...baseRow,
        date: startIso,
        workshop_series: 'one_day' as const,
        series_occurrences: null,
        partner_series_meta: null,
        available_slots: perAvail,
        max_attendees: body.max_attendees,
      }))

      const { data: createdRows, error: insertError } = await admin
        .from('events')
        .insert(insertRows)
        .select()

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      await admin
        .from('vendor_profiles')
        .update({ first_session_created: true })
        .eq('id', vendor.id)
        .eq('first_session_created', false)

      const rows = (createdRows ?? []).map((created) => ({
        ...created,
        status: created.booking_status,
      }))

      for (const created of createdRows ?? []) {
        if (created?.id) {
          scheduleVendorSessionCalendarSync(admin, vendor.id, String(created.id))
        }
      }

      return NextResponse.json(
        {
          sessions: rows,
          session: rows[0] ?? null,
          created_count: rows.length,
        },
        { status: 201 }
      )
    }

    // Lite single-workshop quota (already checked above when count >= limit).
    // Repeating-days batch uses the stricter remaining-slots check above.

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
        // Legacy path: non-daily multi_week without cohort (should be rare after daily batch split)
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
      scheduleVendorSessionCalendarSync(admin, vendor.id, String(created.id))
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
