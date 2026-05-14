import { addWeeks } from 'date-fns'

/** Subset of partner session POST/PUT body used to resolve multi-week dates. */
export type PartnerSessionSeriesBody = {
  date?: string
  workshop_series?: 'one_day' | 'multi_week'
  multi_week_occurrence_count?: number
  multi_week_schedule?: 'same_day_time' | 'custom_times'
  multi_week_additional_datetimes?: string[]
}

export function parseUserDateTime(s: string): Date | null {
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * One DB row per workshop: multi-week is stored as `workshop_series: multi_week` + `series_occurrences`.
 * Infer multi-week when the client omits `workshop_series` (would default to `one_day`) but sends
 * a full recurring payload.
 */
export function inferSeriesKind(body: PartnerSessionSeriesBody): 'one_day' | 'multi_week' {
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
export function resolveWorkshopSeriesDates(
  body: PartnerSessionSeriesBody
): { ok: true; dates: string[] } | { ok: false; error: string } {
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
