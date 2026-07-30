import {
  countBookingsPerOccurrence,
  setSeriesAvailabilityFromRules,
  type BookingRowForAvailability,
} from '@/lib/partner-event-availability'
import { parseWorkshopDateTimeInput } from '@/lib/workshop-timezone'
import {
  findOccurrenceIndexByStart,
  parseSeriesOccurrences,
  seriesAllFullyBooked,
  type EventSeriesFields,
  type SeriesOccurrence,
} from '@/lib/workshop-series'

const MIN_REPEATING_DAYS_SESSIONS = 2

export type OccurrenceMutationSession = EventSeriesFields & {
  id: string | number
  external_booked_count?: number | null
  booking_status?: string | null
  partner_series_meta?: { pattern?: string } | null
  series_google_calendar_event_ids?: unknown
  series_microsoft_outlook_event_ids?: unknown
}

export type OccurrencePatchInput = {
  occurrence_start: string
  start?: string
  max_attendees?: number
  registration_closed?: boolean
  /** null clears the override (inherit parent workshop). */
  title?: string | null
  duration_minutes?: number | null
  location?: string | null
  location_lat?: number | null
  location_lng?: number | null
  price_cad?: number | null
  sale_price_cad?: number | null
}

function clearOverride(occ: SeriesOccurrence, key: keyof SeriesOccurrence): SeriesOccurrence {
  if (!(key in occ)) return occ
  const next = { ...occ }
  delete next[key]
  return next
}

function parseIdArray(v: unknown): (string | null)[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => (typeof x === 'string' && x.length > 0 ? x : null))
}

function assertRepeatingDaysSeries(session: OccurrenceMutationSession): SeriesOccurrence[] | { error: string } {
  const meta = session.partner_series_meta as { pattern?: string } | null | undefined
  if (meta?.pattern !== 'daily_weekdays') {
    return { error: 'Per-session edits are only available for Repeating days workshops.' }
  }
  const series = parseSeriesOccurrences(session)
  if (series.length < MIN_REPEATING_DAYS_SESSIONS) {
    return { error: 'This workshop has no per-session schedule to edit.' }
  }
  return series
}

function countActiveBookingsAtStart(
  bookings: BookingRowForAvailability[],
  occurrenceStart: string
): number {
  const stub = [{ start: occurrenceStart, max_attendees: 1, available_slots: 1 }]
  return countBookingsPerOccurrence(bookings, [occurrenceStart])[0] ?? 0
}

/** Keep calendar id arrays aligned when occurrences are re-sorted by start time. */
function resortOccurrencesWithCalendarIds(
  occ: SeriesOccurrence[],
  googleIds: (string | null)[],
  msIds: (string | null)[]
): {
  series: SeriesOccurrence[]
  googleIds: (string | null)[]
  msIds: (string | null)[]
} {
  const items = occ.map((o, i) => ({
    occ: o,
    g: googleIds[i] ?? null,
    m: msIds[i] ?? null,
    t: new Date(o.start).getTime(),
  }))
  items.sort((a, b) => a.t - b.t)
  return {
    series: items.map((x) => x.occ),
    googleIds: items.map((x) => x.g),
    msIds: items.map((x) => x.m),
  }
}

function spliceCalendarIds(ids: (string | null)[], index: number): (string | null)[] | null {
  if (ids.length === 0) return null
  const next = [...ids]
  if (index >= 0 && index < next.length) next.splice(index, 1)
  return next.length > 0 ? next : null
}

function buildEventUpdateFromSeries(
  session: OccurrenceMutationSession,
  series: SeriesOccurrence[],
  extRaw: number,
  bookedPer: number[],
  googleIds: (string | null)[] | null,
  msIds: (string | null)[] | null
): Record<string, unknown> {
  const withAvail = setSeriesAvailabilityFromRules(series, extRaw, bookedPer)
  const sumAvail = withAvail.reduce((a, o) => a + o.available_slots, 0)
  const sumMax = withAvail.reduce((a, o) => a + o.max_attendees, 0)
  const status = session.booking_status
  const nextStatus =
    seriesAllFullyBooked(withAvail) && (status === 'published' || status === 'fully_booked')
      ? 'fully_booked'
      : status === 'fully_booked' && sumAvail > 0
        ? 'published'
        : status

  const patch: Record<string, unknown> = {
    workshop_series: 'multi_week',
    series_occurrences: withAvail,
    date: withAvail[0]?.start ?? null,
    available_slots: sumAvail,
    max_attendees: sumMax,
    booking_status: nextStatus,
  }

  if (googleIds !== undefined) {
    patch.series_google_calendar_event_ids = googleIds
  }
  if (msIds !== undefined) {
    patch.series_microsoft_outlook_event_ids = msIds
  }

  return patch
}

export function patchRepeatingDaysOccurrence(
  session: OccurrenceMutationSession,
  bookings: BookingRowForAvailability[],
  input: OccurrencePatchInput
): { ok: true; update: Record<string, unknown>; bookingSessionMigrations: Array<{ from: string; to: string }> } | { ok: false; error: string } {
  const seriesOrErr = assertRepeatingDaysSeries(session)
  if ('error' in seriesOrErr) return { ok: false, error: seriesOrErr.error }

  const idx = findOccurrenceIndexByStart(seriesOrErr, input.occurrence_start)
  if (idx < 0) return { ok: false, error: 'Session not found on this workshop.' }

  const extRaw = Math.max(0, Number(session.external_booked_count ?? 0))
  const googleIds = parseIdArray(session.series_google_calendar_event_ids)
  const msIds = parseIdArray(session.series_microsoft_outlook_event_ids)

  let series = [...seriesOrErr]
  const oldStart = series[idx].start
  const bookedHere = countActiveBookingsAtStart(bookings, oldStart)

  if (input.max_attendees !== undefined) {
    const max = input.max_attendees
    if (!Number.isFinite(max) || max < 1 || max > 500) {
      return { ok: false, error: 'Max spots must be between 1 and 500.' }
    }
    if (max < bookedHere + extRaw) {
      return {
        ok: false,
        error: `Cannot set max spots below ${bookedHere + extRaw} (${bookedHere} booked on Offhrs${extRaw > 0 ? ` + ${extRaw} elsewhere` : ''}).`,
      }
    }
    series[idx] = { ...series[idx], max_attendees: max }
  }

  if (input.registration_closed !== undefined) {
    series[idx] = { ...series[idx], registration_closed: input.registration_closed }
  }

  if (input.title !== undefined) {
    if (input.title === null || !input.title.trim()) {
      series[idx] = clearOverride(series[idx], 'title')
    } else {
      series[idx] = { ...series[idx], title: input.title.trim().slice(0, 120) }
    }
  }

  if (input.duration_minutes !== undefined) {
    if (input.duration_minutes === null) {
      series[idx] = clearOverride(series[idx], 'duration_minutes')
    } else {
      const d = input.duration_minutes
      if (!Number.isFinite(d) || d < 15 || d > 480) {
        return { ok: false, error: 'Duration must be between 15 and 480 minutes.' }
      }
      series[idx] = { ...series[idx], duration_minutes: Math.floor(d) }
    }
  }

  if (input.location !== undefined) {
    if (input.location === null || !input.location.trim()) {
      let next = clearOverride(series[idx], 'location')
      next = clearOverride(next, 'lat')
      next = clearOverride(next, 'lng')
      series[idx] = next
    } else {
      const next: SeriesOccurrence = {
        ...series[idx],
        location: input.location.trim().slice(0, 500),
      }
      if (
        input.location_lat != null &&
        input.location_lng != null &&
        Number.isFinite(input.location_lat) &&
        Number.isFinite(input.location_lng)
      ) {
        next.lat = input.location_lat
        next.lng = input.location_lng
      } else {
        delete next.lat
        delete next.lng
      }
      series[idx] = next
    }
  } else if (input.location_lat !== undefined || input.location_lng !== undefined) {
    if (input.location_lat === null || input.location_lng === null) {
      let next = clearOverride(series[idx], 'lat')
      next = clearOverride(next, 'lng')
      series[idx] = next
    } else if (
      input.location_lat != null &&
      input.location_lng != null &&
      Number.isFinite(input.location_lat) &&
      Number.isFinite(input.location_lng)
    ) {
      series[idx] = {
        ...series[idx],
        lat: input.location_lat,
        lng: input.location_lng,
      }
    }
  }

  if (input.price_cad !== undefined) {
    if (input.price_cad === null) {
      let next = clearOverride(series[idx], 'price_cad')
      next = clearOverride(next, 'sale_price_cad')
      series[idx] = next
    } else {
      const price = Math.round(Number(input.price_cad) * 100) / 100
      if (!Number.isFinite(price) || price < 0 || price > 10000) {
        return { ok: false, error: 'Price must be between $0 and $10,000.' }
      }
      let sale: number | null = null
      if (input.sale_price_cad !== undefined && input.sale_price_cad !== null) {
        sale = Math.round(Number(input.sale_price_cad) * 100) / 100
        if (!Number.isFinite(sale) || sale < 0) {
          return { ok: false, error: 'Invalid sale price.' }
        }
        if (!(sale < price)) {
          return {
            ok: false,
            error: `Sale price must be strictly below the session price ($${price.toFixed(2)}).`,
          }
        }
      }
      series[idx] = { ...series[idx], price_cad: price, sale_price_cad: sale }
    }
  } else if (input.sale_price_cad !== undefined && series[idx].price_cad != null) {
    if (input.sale_price_cad === null) {
      series[idx] = { ...series[idx], sale_price_cad: null }
    } else {
      const price = series[idx].price_cad!
      const sale = Math.round(Number(input.sale_price_cad) * 100) / 100
      if (!Number.isFinite(sale) || sale < 0 || !(sale < price)) {
        return {
          ok: false,
          error: `Sale price must be strictly below the session price ($${price.toFixed(2)}).`,
        }
      }
      series[idx] = { ...series[idx], sale_price_cad: sale }
    }
  }

  const bookingSessionMigrations: Array<{ from: string; to: string }> = []

  if (input.start !== undefined && input.start.trim()) {
    const parsed = parseWorkshopDateTimeInput(input.start)
    if (!parsed) return { ok: false, error: 'Invalid date & time.' }
    const newStartIso = parsed.toISOString()

    const newT = new Date(newStartIso).getTime()
    for (let i = 0; i < series.length; i++) {
      if (i === idx) continue
      const t = new Date(series[i].start).getTime()
      if (!Number.isNaN(t) && !Number.isNaN(newT) && Math.abs(t - newT) <= 3 * 60 * 1000) {
        return { ok: false, error: 'Another session already uses this date & time.' }
      }
    }

    series[idx] = { ...series[idx], start: newStartIso }
    if (newStartIso !== oldStart) {
      bookingSessionMigrations.push({ from: oldStart, to: newStartIso })
    }
  }

  const resorted = resortOccurrencesWithCalendarIds(series, googleIds, msIds)
  series = resorted.series

  const bookedPer = countBookingsPerOccurrence(
    bookings.map((b) => {
      const mig = bookingSessionMigrations.find((m) => m.from === b.session_starts_at)
      return mig ? { ...b, session_starts_at: mig.to } : b
    }),
    series.map((o) => o.start)
  )

  const update = buildEventUpdateFromSeries(
    session,
    series,
    extRaw,
    bookedPer,
    resorted.googleIds.length > 0 ? resorted.googleIds : null,
    resorted.msIds.length > 0 ? resorted.msIds : null
  )

  return { ok: true, update, bookingSessionMigrations }
}

export function cancelRepeatingDaysOccurrence(
  session: OccurrenceMutationSession,
  bookings: BookingRowForAvailability[],
  occurrenceStart: string
): { ok: true; update: Record<string, unknown> } | { ok: false; error: string } {
  const seriesOrErr = assertRepeatingDaysSeries(session)
  if ('error' in seriesOrErr) return { ok: false, error: seriesOrErr.error }

  const idx = findOccurrenceIndexByStart(seriesOrErr, occurrenceStart)
  if (idx < 0) return { ok: false, error: 'Session not found on this workshop.' }

  const bookedHere = countActiveBookingsAtStart(bookings, seriesOrErr[idx].start)
  if (bookedHere > 0) {
    return {
      ok: false,
      error: `This session has ${bookedHere} active booking${bookedHere === 1 ? '' : 's'}. Refund or cancel them before removing the session.`,
    }
  }

  if (seriesOrErr.length <= MIN_REPEATING_DAYS_SESSIONS) {
    return {
      ok: false,
      error: `A Repeating days workshop must keep at least ${MIN_REPEATING_DAYS_SESSIONS} sessions. Archive the whole workshop instead.`,
    }
  }

  const extRaw = Math.max(0, Number(session.external_booked_count ?? 0))
  const googleIds = parseIdArray(session.series_google_calendar_event_ids)
  const msIds = parseIdArray(session.series_microsoft_outlook_event_ids)

  const series = seriesOrErr.filter((_, i) => i !== idx)
  const nextGoogle = spliceCalendarIds(googleIds, idx)
  const nextMs = spliceCalendarIds(msIds, idx)

  const bookedPer = countBookingsPerOccurrence(bookings, series.map((o) => o.start))
  const update = buildEventUpdateFromSeries(session, series, extRaw, bookedPer, nextGoogle, nextMs)

  return { ok: true, update }
}
