/** Partner multi-week workshops: one `events` row + `series_occurrences` JSON. */

export type WorkshopSeriesKind = 'one_day' | 'multi_week'

export type SeriesOccurrence = {
  start: string
  max_attendees: number
  available_slots: number
}

export type EventSeriesFields = {
  workshop_series?: string | null
  series_occurrences?: unknown
  date?: string | null
  booking_status?: string | null
  max_attendees?: number | null
  available_slots?: number | null
}

export function isMultiWeekEvent(row: EventSeriesFields): boolean {
  return row.workshop_series === 'multi_week' && parseSeriesOccurrences(row).length > 0
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
      out.push({ start, max_attendees: max, available_slots: avail })
    }
  }
  out.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  return out
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
      return { start, max_attendees: max, available_slots: avail }
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
