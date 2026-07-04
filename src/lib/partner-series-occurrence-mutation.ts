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
