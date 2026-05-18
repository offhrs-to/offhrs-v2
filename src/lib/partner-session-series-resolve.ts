import { addWeeks } from 'date-fns'
import { getMaterializedInstanceDates } from '@/lib/recurring-event-instances'
import { parseWorkshopDateTimeInput } from '@/lib/workshop-timezone'

/** Partner multi-date schedules (stored as one `events` row + `series_occurrences`). */
export type PartnerMultiWeekSchedule = 'same_day_time' | 'custom_times' | 'daily_weekdays'

/** Subset of partner session POST/PUT body used to resolve multi-week dates. */
export type PartnerSessionSeriesBody = {
  date?: string
  workshop_series?: 'one_day' | 'multi_week'
  multi_week_occurrence_count?: number
  multi_week_schedule?: PartnerMultiWeekSchedule
  multi_week_additional_datetimes?: string[]
  /** JS weekday indices 0–6 (Sun–Sat); for `daily_weekdays` only. */
  multi_week_daily_js_weekdays?: number[]
}

/** @deprecated Use parseWorkshopDateTimeInput — kept as alias for existing imports. */
export function parseUserDateTime(s: string): Date | null {
  return parseWorkshopDateTimeInput(s)
}

/**
 * One DB row per workshop: multi-week is stored as `workshop_series: multi_week` + `series_occurrences`.
 * Infer multi-week when the client omits `workshop_series` (would default to `one_day`) but sends
 * a full recurring payload.
 */
export function inferSeriesKind(body: PartnerSessionSeriesBody): 'one_day' | 'multi_week' {
  if (body.workshop_series === 'multi_week') return 'multi_week'
  if (body.multi_week_schedule === 'daily_weekdays' && body.date?.trim()) {
    return 'multi_week'
  }
  if (
    typeof body.multi_week_occurrence_count === 'number' &&
    body.multi_week_occurrence_count > 1 &&
    body.multi_week_schedule &&
    body.multi_week_schedule !== 'daily_weekdays'
  ) {
    return 'multi_week'
  }
  return 'one_day'
}

/** ISO strings for each occurrence (sorted ascending for custom weekly). */
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

  const schedule = body.multi_week_schedule
  if (!schedule) return { ok: false, error: 'Choose how this workshop repeats.' }

  if (schedule === 'daily_weekdays') {
    const raw = body.multi_week_daily_js_weekdays
    const set = new Set<number>(
      Array.isArray(raw) && raw.length > 0 ? raw.filter((n) => n >= 0 && n <= 6) : [0, 1, 2, 3, 4, 5, 6]
    )
    if (set.size === 0) {
      return { ok: false, error: 'Select at least one day of the week for repeating sessions.' }
    }
    const dates = getMaterializedInstanceDates(first, 'daily', { dailyWeekdays: set })
    if (dates.length < 2) {
      return {
        ok: false,
        error:
          'With these weekdays, not enough session dates fall in the next scheduling window. Pick another start date or add more weekdays.',
      }
    }
    return { ok: true, dates }
  }

  const count = body.multi_week_occurrence_count
  if (!count) return { ok: false, error: 'Choose how many weeks this recurring workshop runs.' }

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

export type PartnerSeriesMeta = {
  pattern: 'weekly_same' | 'weekly_custom' | 'daily_weekdays'
  weeks?: number
  daily_js_weekdays?: number[]
}

/** Persisted on `events.partner_series_meta` so the vendor form can restore schedule type. */
export function buildPartnerSeriesMeta(merged: PartnerSessionSeriesBody): PartnerSeriesMeta | null {
  if (inferSeriesKind(merged) !== 'multi_week') return null
  const sch = merged.multi_week_schedule
  if (sch === 'daily_weekdays') {
    const w =
      merged.multi_week_daily_js_weekdays?.filter((n) => n >= 0 && n <= 6) ?? [0, 1, 2, 3, 4, 5, 6]
    return {
      pattern: 'daily_weekdays',
      daily_js_weekdays: [...new Set(w)].sort((a, b) => a - b),
    }
  }
  if (sch === 'same_day_time' && merged.multi_week_occurrence_count) {
    return { pattern: 'weekly_same', weeks: merged.multi_week_occurrence_count }
  }
  if (sch === 'custom_times' && merged.multi_week_occurrence_count) {
    return { pattern: 'weekly_custom', weeks: merged.multi_week_occurrence_count }
  }
  return null
}
