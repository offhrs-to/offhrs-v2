/** Partner multi-week workshops: one `events` row + `series_occurrences` JSON. */

export type WorkshopSeriesKind = 'one_day' | 'multi_week'

export type SeriesOccurrence = {
  start: string
  max_attendees: number
  available_slots: number
  /** When true, this session is hidden from browse and not bookable (per-occurrence series). */
  registration_closed?: boolean
  /** Optional per-session overrides (missing = inherit parent workshop). */
  title?: string
  duration_minutes?: number
  location?: string
  lat?: number
  lng?: number
  price_cad?: number
  /** When `price_cad` is set on this occurrence, sale is also session-local (null = no sale). */
  sale_price_cad?: number | null
}

export type EventSeriesFields = {
  workshop_series?: string | null
  series_occurrences?: unknown
  date?: string | null
  booking_status?: string | null
  max_attendees?: number | null
  available_slots?: number | null
  partner_series_meta?: unknown
}

export function isMultiWeekEvent(row: EventSeriesFields): boolean {
  return row.workshop_series === 'multi_week' && parseSeriesOccurrences(row).length > 0
}

/**
 * Cohort vs per-occurrence semantics for multi-week series.
 *
 * - `cohort`: same group attends every session (e.g. weekly pottery course).
 *   Capacity is a single cohort number; one booking holds a seat across all
 *   weeks. `weekly_same` and `weekly_custom` patterns use this mode.
 * - `per_occurrence`: each session is independently bookable (e.g. drop-in
 *   classes). `daily_weekdays` uses this mode.
 *
 * Defaults to `per_occurrence` when meta is missing/unknown so legacy rows
 * without a pattern marker preserve the original behavior.
 */
export type SeriesMode = 'cohort' | 'per_occurrence'

export function getSeriesMode(row: EventSeriesFields): SeriesMode {
  const meta = row.partner_series_meta as { pattern?: string } | null | undefined
  const pattern = meta?.pattern
  if (pattern === 'weekly_same' || pattern === 'weekly_custom') return 'cohort'
  return 'per_occurrence'
}

export function applyCohortAvailability(
  occ: SeriesOccurrence[],
  maxAttendees: number,
  availableSlots: number
): SeriesOccurrence[] {
  return occ.map((o) => ({
    ...o,
    max_attendees: maxAttendees,
    available_slots: availableSlots,
  }))
}

export function parseSeriesOccurrences(row: EventSeriesFields): SeriesOccurrence[] {
  if (row.workshop_series !== 'multi_week') return []
  const raw = row.series_occurrences
  if (!Array.isArray(raw)) return []
  const out: SeriesOccurrence[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const start = typeof o.start === 'string' ? o.start : ''
    const max = Number(o.max_attendees)
    const avail = Number(o.available_slots)
    if (start && Number.isFinite(max) && Number.isFinite(avail)) {
      const registration_closed = o.registration_closed === true
      const overrides = pickSeriesOccurrenceOverrides(o)
      out.push({
        start,
        max_attendees: max,
        available_slots: avail,
        ...(registration_closed ? { registration_closed: true } : {}),
        ...overrides,
      })
    }
  }
  out.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  return out
}

/** Read optional per-session override fields from raw JSON. */
export function pickSeriesOccurrenceOverrides(
  o: Record<string, unknown>
): Partial<
  Pick<
    SeriesOccurrence,
    'title' | 'duration_minutes' | 'location' | 'lat' | 'lng' | 'price_cad' | 'sale_price_cad'
  >
> {
  const out: Partial<SeriesOccurrence> = {}
  if (typeof o.title === 'string' && o.title.trim()) {
    out.title = o.title.trim().slice(0, 120)
  }
  const duration = Number(o.duration_minutes)
  if (Number.isFinite(duration) && duration >= 15 && duration <= 480) {
    out.duration_minutes = Math.floor(duration)
  }
  if (typeof o.location === 'string' && o.location.trim()) {
    out.location = o.location.trim().slice(0, 500)
  }
  const lat = Number(o.lat)
  const lng = Number(o.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    out.lat = lat
    out.lng = lng
  }
  if (o.price_cad != null && o.price_cad !== '') {
    const price = Number(o.price_cad)
    if (Number.isFinite(price) && price >= 0 && price <= 10000) {
      out.price_cad = Math.round(price * 100) / 100
      if (o.sale_price_cad === null) {
        out.sale_price_cad = null
      } else if (o.sale_price_cad != null && o.sale_price_cad !== '') {
        const sale = Number(o.sale_price_cad)
        if (Number.isFinite(sale) && sale >= 0 && sale < out.price_cad) {
          out.sale_price_cad = Math.round(sale * 100) / 100
        } else {
          out.sale_price_cad = null
        }
      } else {
        out.sale_price_cad = null
      }
    }
  }
  return out
}

/**
 * Resolve listing/checkout fields for one series occurrence (inherit parent when unset).
 */
export function resolveOccurrenceListingFields<
  T extends {
    title?: string | null
    duration_minutes?: number | null
    location?: string | null
    lat?: number | null
    lng?: number | null
    price_cad?: number | null
    sale_price_cad?: number | null
    sale_starts_on?: string | null
    sale_ends_on?: string | null
  },
>(
  parent: T,
  occ: SeriesOccurrence | null | undefined
): {
  title: string | null | undefined
  duration_minutes: number | null | undefined
  location: string | null | undefined
  lat: number | null | undefined
  lng: number | null | undefined
  price_cad: number | null | undefined
  sale_price_cad: number | null | undefined
  sale_starts_on: string | null | undefined
  sale_ends_on: string | null | undefined
} {
  if (!occ) {
    return {
      title: parent.title,
      duration_minutes: parent.duration_minutes,
      location: parent.location,
      lat: parent.lat,
      lng: parent.lng,
      price_cad: parent.price_cad,
      sale_price_cad: parent.sale_price_cad,
      sale_starts_on: parent.sale_starts_on,
      sale_ends_on: parent.sale_ends_on,
    }
  }
  const hasPriceOverride = occ.price_cad != null
  return {
    title: occ.title?.trim() || parent.title,
    duration_minutes: occ.duration_minutes ?? parent.duration_minutes,
    location: occ.location?.trim() || parent.location,
    lat: occ.location?.trim() ? (occ.lat ?? null) : parent.lat,
    lng: occ.location?.trim() ? (occ.lng ?? null) : parent.lng,
    price_cad: hasPriceOverride ? occ.price_cad : parent.price_cad,
    sale_price_cad: hasPriceOverride
      ? (occ.sale_price_cad ?? null)
      : parent.sale_price_cad,
    sale_starts_on: hasPriceOverride ? null : parent.sale_starts_on,
    sale_ends_on: hasPriceOverride ? null : parent.sale_ends_on,
  }
}

/** Resolve parent + matching occurrence overrides for a booking start time. */
export function eventFieldsForOccurrenceStart<
  T extends {
    title?: string | null
    duration_minutes?: number | null
    location?: string | null
    lat?: number | null
    lng?: number | null
    price_cad?: number | null
    sale_price_cad?: number | null
    sale_starts_on?: string | null
    sale_ends_on?: string | null
    workshop_series?: string | null
    series_occurrences?: unknown
  },
>(parent: T, startTime?: string | null) {
  const series = parseSeriesOccurrences(parent)
  if (series.length === 0) return resolveOccurrenceListingFields(parent, null)
  const idx = findOccurrenceIndexByStart(series, startTime ?? undefined)
  return resolveOccurrenceListingFields(parent, idx >= 0 ? series[idx] : null)
}

export function buildSeriesOccurrencesFromDateIsos(dateIsos: string[], maxAttendees: number): SeriesOccurrence[] {
  const sorted = [...dateIsos].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  return sorted.map((start) => ({
    start,
    max_attendees: maxAttendees,
    available_slots: maxAttendees,
  }))
}

/** If starts are ~7 days apart, treat as same weekday/time pattern; otherwise custom schedule. */
export function inferScheduleFromOccurrences(occ: SeriesOccurrence[]): 'same_day_time' | 'custom_times' {
  if (occ.length < 2) return 'same_day_time'
  for (let i = 1; i < occ.length; i++) {
    const days =
      (new Date(occ[i].start).getTime() - new Date(occ[i - 1].start).getTime()) / (24 * 60 * 60 * 1000)
    if (Math.abs(days - 7) > 0.35) return 'custom_times'
  }
  return 'same_day_time'
}

const MATCH_START_MS = 5 * 60 * 1000

/** Rebuild series rows for new dates while keeping slots when a start time still matches (±5 min). */
export function mergeSeriesOccurrencesPreservingSlots(
  dateIsos: string[],
  maxPerOccurrence: number,
  previous: SeriesOccurrence[]
): SeriesOccurrence[] {
  const sorted = [...dateIsos].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  return sorted.map((start, idx) => {
    let best: SeriesOccurrence | undefined
    let bestDelta = Infinity
    for (const p of previous) {
      const d = Math.abs(new Date(p.start).getTime() - new Date(start).getTime())
      if (d < bestDelta) {
        bestDelta = d
        best = p
      }
    }
    const matched =
      best && bestDelta <= MATCH_START_MS ? best : previous[idx] && idx < previous.length ? previous[idx] : undefined
    const max = maxPerOccurrence
    if (matched && bestDelta <= MATCH_START_MS) {
      const avail = Math.min(Math.max(0, matched.available_slots), max)
      const {
        title,
        duration_minutes,
        location,
        lat,
        lng,
        price_cad,
        sale_price_cad,
        registration_closed,
      } = matched
      return {
        start,
        max_attendees: max,
        available_slots: avail,
        ...(registration_closed ? { registration_closed: true } : {}),
        ...(title ? { title } : {}),
        ...(duration_minutes != null ? { duration_minutes } : {}),
        ...(location ? { location } : {}),
        ...(lat != null && lng != null ? { lat, lng } : {}),
        ...(price_cad != null
          ? { price_cad, sale_price_cad: sale_price_cad ?? null }
          : {}),
      }
    }
    return { start, max_attendees: max, available_slots: max }
  })
}

export function minAvailableAcrossSeries(series: SeriesOccurrence[]): number {
  if (series.length === 0) return 0
  return Math.min(...series.map((o) => o.available_slots))
}

/** Match client `datetime-local` or ISO string to a series occurrence index. */
export function findOccurrenceIndexByStart(series: SeriesOccurrence[], candidate: string | undefined): number {
  if (series.length === 0) return -1
  if (!candidate?.trim()) return 0
  const t = new Date(candidate).getTime()
  if (Number.isNaN(t)) return -1
  let best = 0
  let bestDelta = Infinity
  for (let i = 0; i < series.length; i++) {
    const dt = new Date(series[i].start).getTime()
    if (Number.isNaN(dt)) continue
    const d = Math.abs(dt - t)
    if (d < bestDelta) {
      bestDelta = d
      best = i
    }
  }
  // Within 3 minutes = same slot (datetime-local vs ISO drift)
  if (bestDelta <= 3 * 60 * 1000) return best
  return -1
}

export function seriesAllFullyBooked(series: SeriesOccurrence[]): boolean {
  return series.length > 0 && series.every((o) => o.available_slots <= 0)
}

export function withDecrementedOccurrence(
  series: SeriesOccurrence[],
  index: number
): SeriesOccurrence[] | null {
  if (index < 0 || index >= series.length) return null
  const occ = series[index]
  if (occ.available_slots <= 0) return null
  return series.map((o, i) =>
    i === index ? { ...o, available_slots: Math.max(0, o.available_slots - 1) } : { ...o }
  )
}

export function withIncrementedOccurrence(series: SeriesOccurrence[], index: number): SeriesOccurrence[] {
  return series.map((o, i) =>
    i === index ? { ...o, available_slots: Math.min(o.max_attendees, o.available_slots + 1) } : { ...o }
  )
}

/** After a successful booking: new series JSON (or null), top-level available_slots, booking_status. */
export function computeSlotDecrementForEvent(
  row: EventSeriesFields,
  startTimeInput: string | undefined,
  metaStart?: string
):
  | { ok: false; error: string }
  | {
      ok: true
      series_occurrences: SeriesOccurrence[] | null
      available_slots: number
      booking_status: string | null | undefined
      sessionStartsAtIso: string
    } {
  const series = parseSeriesOccurrences(row)
  const candidate = startTimeInput?.trim() || metaStart?.trim() || row.date || ''
  if (!candidate) return { ok: false, error: 'Missing session time.' }

  if (series.length > 0) {
    const idx = findOccurrenceIndexByStart(series, candidate)
    if (idx < 0) return { ok: false, error: 'Pick a valid session time for this workshop.' }

    if (getSeriesMode(row) === 'cohort') {
      const cohortMax = series[0].max_attendees ?? row.max_attendees ?? 0
      const cohortAvail = Math.min(
        ...series.map((o) => (Number.isFinite(o.available_slots) ? o.available_slots : 0))
      )
      if (cohortAvail <= 0) return { ok: false, error: 'No spots left in this cohort.' }
      const nextAvail = Math.max(0, cohortAvail - 1)
      const next = applyCohortAvailability(series, cohortMax, nextAvail)
      const allFull = nextAvail <= 0
      const nextStatus =
        allFull && (row.booking_status === 'published' || row.booking_status === 'fully_booked')
          ? 'fully_booked'
          : row.booking_status
      return {
        ok: true,
        series_occurrences: next,
        available_slots: nextAvail,
        booking_status: nextStatus,
        sessionStartsAtIso: series[idx].start,
      }
    }

    const next = withDecrementedOccurrence(series, idx)
    if (!next) return { ok: false, error: 'No spots left for that session time.' }
    const sumAvail = next.reduce((a, o) => a + o.available_slots, 0)
    const allFull = seriesAllFullyBooked(next)
    const nextStatus =
      allFull && (row.booking_status === 'published' || row.booking_status === 'fully_booked')
        ? 'fully_booked'
        : row.booking_status
    return {
      ok: true,
      series_occurrences: next,
      available_slots: sumAvail,
      booking_status: nextStatus,
      sessionStartsAtIso: next[idx].start,
    }
  }

  const avail = row.available_slots ?? row.max_attendees ?? 0
  if (avail <= 0) return { ok: false, error: 'No spots remaining.' }
  const sessionStartsAtIso = new Date(candidate).toISOString()
  if (Number.isNaN(new Date(sessionStartsAtIso).getTime())) {
    return { ok: false, error: 'Invalid session time.' }
  }
  const newSlots = Math.max(0, avail - 1)
  const newStatus =
    newSlots === 0 && (row.booking_status === 'published' || row.booking_status === 'fully_booked')
      ? 'fully_booked'
      : row.booking_status
  return {
    ok: true,
    series_occurrences: null,
    available_slots: newSlots,
    booking_status: newStatus,
    sessionStartsAtIso,
  }
}

export function computeSlotIncrementForEvent(
  row: EventSeriesFields,
  sessionStartsAtIso: string | null | undefined
): { series_occurrences: SeriesOccurrence[] | null; available_slots: number; booking_status: string | null | undefined } | null {
  const series = parseSeriesOccurrences(row)
  if (series.length > 0) {
    if (getSeriesMode(row) === 'cohort') {
      const cohortMax = series[0].max_attendees ?? row.max_attendees ?? 0
      const cohortAvail = Math.min(
        ...series.map((o) => (Number.isFinite(o.available_slots) ? o.available_slots : 0))
      )
      const nextAvail = Math.min(cohortMax, cohortAvail + 1)
      const next = applyCohortAvailability(series, cohortMax, nextAvail)
      const nextStatus =
        row.booking_status === 'fully_booked' && nextAvail > 0 ? 'published' : row.booking_status
      return { series_occurrences: next, available_slots: nextAvail, booking_status: nextStatus }
    }
    const idx = findOccurrenceIndexByStart(series, sessionStartsAtIso ?? '')
    if (idx < 0) return null
    const next = withIncrementedOccurrence(series, idx)
    const sumAvail = next.reduce((a, o) => a + o.available_slots, 0)
    const nextStatus = row.booking_status === 'fully_booked' && !seriesAllFullyBooked(next) ? 'published' : row.booking_status
    return { series_occurrences: next, available_slots: sumAvail, booking_status: nextStatus }
  }
  const avail = row.available_slots ?? row.max_attendees ?? 0
  const max = row.max_attendees ?? avail + 1
  const newSlots = Math.min(max, avail + 1)
  const nextStatus = row.booking_status === 'fully_booked' && newSlots > 0 ? 'published' : row.booking_status
  return { series_occurrences: null, available_slots: newSlots, booking_status: nextStatus }
}

export type CalendarSessionRow = Record<string, unknown> & {
  id: string | number
  date: string | null
  workshop_series?: string | null
  series_occurrences?: unknown
}

/** One row per calendar cell occurrence; preserves real `id` for edit links. */
export function expandSessionsForCalendarRange(
  sessions: CalendarSessionRow[],
  fromIso: string,
  toIso: string
): Array<CalendarSessionRow & { _occurrenceIndex: number; calendarRowKey: string }> {
  const fromT = new Date(fromIso).getTime()
  const toT = new Date(toIso).getTime()
  const out: Array<CalendarSessionRow & { _occurrenceIndex: number; calendarRowKey: string }> = []

  for (const row of sessions) {
    const series = parseSeriesOccurrences(row)
    const starts = series.length > 0 ? series.map((o) => o.start) : row.date ? [row.date] : []
    starts.forEach((start, idx) => {
      const t = new Date(start).getTime()
      if (Number.isNaN(t) || t < fromT || t > toT) return
      out.push({
        ...row,
        date: start,
        _occurrenceIndex: series.length > 0 ? idx : 0,
        calendarRowKey: `${String(row.id)}:${idx}:${start}`,
      })
    })
  }
  return out
}

export function formatSeriesDateRangeLabel(series: SeriesOccurrence[]): string {
  if (series.length === 0) return ''
  const first = new Date(series[0].start)
  const last = new Date(series[series.length - 1].start)
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return ''
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  if (series.length === 1) return first.toLocaleDateString('en-CA', { ...opts, hour: 'numeric', minute: '2-digit' })
  return `${first.toLocaleDateString('en-CA', opts)} – ${last.toLocaleDateString('en-CA', opts)}`
}
