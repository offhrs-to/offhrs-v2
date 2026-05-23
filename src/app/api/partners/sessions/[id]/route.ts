import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { CATEGORY_ENUM } from '@/constants/categories'
import { z } from 'zod'
import { processBookingRefund } from '@/lib/booking-refund'
import { syncVendorSessionToExternalCalendars } from '@/lib/vendor-calendar-sync'
import type { PartnerSessionSeriesBody } from '@/lib/partner-session-series-resolve'
import { buildPartnerSeriesMeta, resolveWorkshopSeriesDates } from '@/lib/partner-session-series-resolve'
import {
  countActiveCohortBookings,
  countBookingsPerOccurrence,
  setSeriesAvailabilityFromRules,
} from '@/lib/partner-event-availability'
import {
  applyCohortAvailability,
  inferScheduleFromOccurrences,
  mergeSeriesOccurrencesPreservingSlots,
  parseSeriesOccurrences,
  type EventSeriesFields,
} from '@/lib/workshop-series'
import { resolveEventCoordinates } from '@/lib/event-location-coordinates'

const multiWeekOccurrenceSchema = z.number().int().min(2).max(12)
const ACTIVE_BOOKING_STATUSES = ['confirmed', 'pending', 'booked', 'pending_confirmation'] as const

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
  location_lat: z.number().finite().optional().nullable(),
  location_lng: z.number().finite().optional().nullable(),
  location_link: z.string().url().optional(),
  status: z.enum(['published', 'draft', 'archived']).optional(),
  cover_image_url: z.string().url().nullable().optional(),
  workshop_series: z.enum(['one_day', 'multi_week']).optional(),
  multi_week_occurrence_count: multiWeekOccurrenceSchema.optional(),
  multi_week_schedule: z.enum(['same_day_time', 'custom_times', 'daily_weekdays']).optional(),
  multi_week_additional_datetimes: z.array(z.string()).max(11).optional(),
  multi_week_daily_js_weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  multi_week_daily_weeks: z.number().int().min(2).max(12).optional(),
  external_booked_count: z.number().int().min(0).max(500).optional(),
})

type PartnerMeta = {
  pattern?: string
  daily_js_weekdays?: number[]
  weeks?: number
  /** Legacy alias retained for older rows that wrote daily window weeks under a different key. */
  daily_weeks?: number
}

function buildMergedSeriesInput(
  session: Record<string, unknown>,
  body: z.infer<typeof updateSchema>
): PartnerSessionSeriesBody {
  const prevSeries = parseSeriesOccurrences(session as EventSeriesFields)
  const sessionDate = typeof session.date === 'string' ? session.date : undefined
  const sessionIsMulti = String(session.workshop_series) === 'multi_week' && prevSeries.length > 1
  const meta = (session.partner_series_meta as PartnerMeta | null) ?? null

  let schedule = body.multi_week_schedule
  if (schedule === undefined) {
    if (meta?.pattern === 'daily_weekdays') schedule = 'daily_weekdays'
    else if (meta?.pattern === 'weekly_custom') schedule = 'custom_times'
    else if (sessionIsMulti) schedule = inferScheduleFromOccurrences(prevSeries)
    else schedule = undefined
  }

  const dailyJs =
    body.multi_week_daily_js_weekdays ??
    (schedule === 'daily_weekdays' && Array.isArray(meta?.daily_js_weekdays) && meta.daily_js_weekdays.length > 0
      ? meta.daily_js_weekdays
      : schedule === 'daily_weekdays'
        ? [0, 1, 2, 3, 4, 5, 6]
        : undefined)

  const occCount =
    body.multi_week_occurrence_count ??
    (schedule === 'daily_weekdays' ? undefined : (meta?.weeks as number | undefined)) ??
    (sessionIsMulti && schedule !== 'daily_weekdays' ? prevSeries.length : undefined)

  const extrasFromPrev =
    schedule === 'custom_times' && prevSeries.length > 1 ? prevSeries.slice(1).map((o) => o.start) : undefined

  const dailyWeeks =
    body.multi_week_daily_weeks ??
    (schedule === 'daily_weekdays' ? (meta?.weeks as number | undefined) : undefined)

  return {
    date: body.date !== undefined ? body.date : sessionDate,
    workshop_series:
      body.workshop_series !== undefined
        ? body.workshop_series
        : sessionIsMulti
          ? 'multi_week'
          : 'one_day',
    multi_week_occurrence_count: occCount,
    multi_week_schedule: schedule,
    multi_week_additional_datetimes:
      body.multi_week_additional_datetimes !== undefined
        ? body.multi_week_additional_datetimes
        : extrasFromPrev,
    multi_week_daily_js_weekdays: dailyJs,
    multi_week_daily_weeks: dailyWeeks,
  }
}

type Params = { params: Promise<{ id: string }> }

async function getVendorAndSession(userId: string, sessionId: string) {
  const admin = createAdminClient()
  if (!admin) return { admin: null, vendor: null, session: null }

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select(
      'id, business_name, default_workshop_image_url, location_address, location_lat, location_lng'
    )
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
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { admin, vendor, session } = await getVendorAndSession(user.id, id)
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const raw = await request.json()
    const parsed = updateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
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
    if (body.duration_minutes !== undefined) updatePayload.duration_minutes = body.duration_minutes

    const isVirtual =
      body.location_type === 'virtual' ||
      (body.location_link !== undefined && body.location_address === undefined)

    if (isVirtual) {
      if (body.location_link !== undefined) updatePayload.location = body.location_link
      updatePayload.lat = null
      updatePayload.lng = null
    } else {
      if (body.location_address !== undefined) {
        updatePayload.location = body.location_address
      }
      const locationText =
        (body.location_address !== undefined
          ? body.location_address
          : (session.location as string | null)) ?? ''
      const sessionLat = session.lat as number | null | undefined
      const sessionLng = session.lng as number | null | undefined
      const missingCoords = sessionLat == null || sessionLng == null

      if (
        locationText.trim() &&
        (missingCoords ||
          body.location_address !== undefined ||
          body.location_lat !== undefined ||
          body.location_lng !== undefined)
      ) {
        const { lat, lng } = await resolveEventCoordinates({
          location: locationText,
          locationType: 'in_person',
          clientLat: body.location_lat,
          clientLng: body.location_lng,
          vendorProfileAddress: vendor.location_address as string | null,
          vendorProfileLat: vendor.location_lat as number | null,
          vendorProfileLng: vendor.location_lng as number | null,
        })
        updatePayload.lat = lat
        updatePayload.lng = lng
      }
    }
    if (body.cover_image_url !== undefined) {
      if (body.cover_image_url === null) {
        updatePayload.image_url = vendor.default_workshop_image_url ?? null
      } else {
        updatePayload.image_url = body.cover_image_url
      }
    }

    const maxAtt =
      body.max_attendees !== undefined
        ? body.max_attendees
        : typeof session.max_attendees === 'number'
          ? session.max_attendees
          : 10

    const extRaw =
      body.external_booked_count !== undefined
        ? body.external_booked_count
        : ((session as { external_booked_count?: number }).external_booked_count ?? 0)
    if (extRaw > maxAtt) {
      return NextResponse.json(
        { error: 'Spots booked elsewhere cannot exceed max spots (per session date).' },
        { status: 400 }
      )
    }

    const sessionRow = session as Record<string, unknown>
    const mergedSeries = buildMergedSeriesInput(sessionRow, body)
    const resolvedDates = resolveWorkshopSeriesDates(mergedSeries)
    if (!resolvedDates.ok) {
      return NextResponse.json({ error: resolvedDates.error }, { status: 400 })
    }

    const { data: bookingRows } = await admin
      .from('bookings')
      .select('session_starts_at, refunded_at')
      .eq('event_id', id)

    const bookings = bookingRows ?? []

    const dateIsos = resolvedDates.dates
    const prevOcc = parseSeriesOccurrences(session as EventSeriesFields)

    const metaOut = buildPartnerSeriesMeta(mergedSeries)
    updatePayload.external_booked_count = extRaw
    updatePayload.partner_series_meta = metaOut

    if (dateIsos.length === 0) {
      updatePayload.date = null
      updatePayload.workshop_series = 'one_day'
      updatePayload.series_occurrences = null
      updatePayload.max_attendees = maxAtt
      const booked = countBookingsPerOccurrence(bookings, [])
      updatePayload.available_slots = Math.max(0, maxAtt - extRaw - (booked[0] ?? 0))
    } else if (dateIsos.length === 1) {
      updatePayload.date = dateIsos[0]
      updatePayload.workshop_series = 'one_day'
      updatePayload.series_occurrences = null
      updatePayload.max_attendees = maxAtt
      const bookedPer = countBookingsPerOccurrence(bookings, dateIsos)
      updatePayload.available_slots = Math.max(0, maxAtt - extRaw - (bookedPer[0] ?? 0))
    } else {
      const isCohort = metaOut?.pattern === 'weekly_same' || metaOut?.pattern === 'weekly_custom'
      let seriesOcc = mergeSeriesOccurrencesPreservingSlots(dateIsos, maxAtt, prevOcc)

      if (isCohort) {
        const cohortBooked = countActiveCohortBookings(bookings)
        const cohortAvail = Math.max(0, maxAtt - extRaw - cohortBooked)
        seriesOcc = applyCohortAvailability(seriesOcc, maxAtt, cohortAvail)
        updatePayload.date = dateIsos[0]
        updatePayload.workshop_series = 'multi_week'
        updatePayload.series_occurrences = seriesOcc
        updatePayload.available_slots = cohortAvail
        updatePayload.max_attendees = maxAtt
      } else {
        const bookedPer = countBookingsPerOccurrence(
          bookings,
          seriesOcc.map((o) => o.start)
        )
        seriesOcc = setSeriesAvailabilityFromRules(seriesOcc, extRaw, bookedPer)
        const sumAvail = seriesOcc.reduce((a, o) => a + o.available_slots, 0)
        const sumMax = seriesOcc.reduce((a, o) => a + o.max_attendees, 0)
        updatePayload.date = dateIsos[0]
        updatePayload.workshop_series = 'multi_week'
        updatePayload.series_occurrences = seriesOcc
        updatePayload.available_slots = sumAvail
        updatePayload.max_attendees = sumMax
      }
    }

    const businessName = (vendor.business_name as string | null)?.trim()
    if (businessName) {
      updatePayload.organizer = businessName
    }

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
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { admin, vendor, session } = await getVendorAndSession(user.id, id)
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const eventId = Number(id)
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 })
    }

    const { data: activeBookings, error: bookingFetchError } = await admin
      .from('bookings')
      .select('id')
      .eq('event_id', eventId)
      .eq('vendor_id', vendor.id)
      .in('status', [...ACTIVE_BOOKING_STATUSES])
      .is('refunded_at', null)

    if (bookingFetchError) {
      console.error('Session archive booking fetch error:', bookingFetchError)
      return NextResponse.json({ error: bookingFetchError.message }, { status: 500 })
    }

    let refundedCount = 0
    for (const booking of activeBookings ?? []) {
      const bookingId = String(booking.id)
      const refund = await processBookingRefund(admin, bookingId, {
        initiatedBy: 'vendor',
        cancellationReason: 'Workshop archived by vendor',
        skipRefundWindowCheck: true,
      })

      if (!refund.ok) {
        return NextResponse.json(
          {
            error:
              refundedCount > 0
                ? `Archiving was stopped after ${refundedCount} refund${refundedCount === 1 ? '' : 's'} because one booking could not be refunded: ${refund.error}`
                : `Could not archive workshop because a booking could not be refunded: ${refund.error}`,
            refunded: refundedCount,
          },
          { status: refund.status }
        )
      }
      refundedCount++
    }

    const { data: updated, error: updateError } = await admin
      .from('events')
      .update({ booking_status: 'archived' })
      .eq('id', eventId)
      .eq('vendor_profile_id', vendor.id)
      .select('id, booking_status')
      .maybeSingle()

    if (updateError) {
      console.error('Session archive error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
    if (!updated || updated.booking_status !== 'archived') {
      return NextResponse.json({ error: 'Could not archive workshop' }, { status: 500 })
    }

    void syncVendorSessionToExternalCalendars(admin, vendor.id, String(eventId)).catch((e) =>
      console.error('[sessions] calendar sync', e)
    )

    return NextResponse.json({ success: true, archived: true, refunded: refundedCount })
  } catch (err) {
    console.error('Session delete error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
