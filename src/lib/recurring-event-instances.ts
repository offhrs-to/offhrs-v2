const ONE_DAY_MS = 24 * 60 * 60 * 1000
const ONE_WEEK_MS = 7 * ONE_DAY_MS

/** How many calendar weeks of concrete instances we create when saving a renewing event */
export const RENEW_INSTANCES_WEEKS = 4

/** JavaScript weekday indices (Date#getDay): 0 = Sun … 6 = Sat */
export const ALL_JS_WEEKDAYS = new Set<number>([0, 1, 2, 3, 4, 5, 6])

const READ_ONLY_INSERT_KEYS = new Set(['id', 'created_at', 'updated_at'])

export type MaterializeDateOptions = {
  /** For daily recurrence: which weekdays (0–6) get an instance in the 28-day window */
  dailyWeekdays?: Set<number>
}

/**
 * ISO date strings for each concrete event row to insert.
 * - Weekly: 4 occurrences (same weekday/time), spanning 4 weeks from the base date.
 * - Daily: each calendar day in a 28-day window from the base date whose weekday is in `dailyWeekdays` (default: all 7 days).
 */
export function getMaterializedInstanceDates(
  base: Date,
  recurrence: 'daily' | 'weekly',
  options?: MaterializeDateOptions
): string[] {
  if (Number.isNaN(base.getTime())) return []

  const out: string[] = []
  if (recurrence === 'weekly') {
    for (let i = 0; i < RENEW_INSTANCES_WEEKS; i++) {
      const d = new Date(base.getTime() + i * ONE_WEEK_MS)
      out.push(d.toISOString())
    }
  } else {
    const days = RENEW_INSTANCES_WEEKS * 7
    const allowed = options?.dailyWeekdays ?? ALL_JS_WEEKDAYS
    if (allowed.size === 0) return []
    for (let i = 0; i < days; i++) {
      const d = new Date(base.getTime() + i * ONE_DAY_MS)
      if (allowed.has(d.getDay())) {
        out.push(d.toISOString())
      }
    }
  }
  return out
}

/** How many daily instances fall in the standard window for the given start date and weekday filter. */
export function countDailyInstancesInWindow(
  base: Date,
  weekdays: Set<number>,
  windowDays: number = RENEW_INSTANCES_WEEKS * 7
): number {
  if (Number.isNaN(base.getTime()) || weekdays.size === 0) return 0
  let c = 0
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(base.getTime() + i * ONE_DAY_MS)
    if (weekdays.has(d.getDay())) c++
  }
  return c
}

/**
 * Full event payloads for each occurrence (all with `recurrence: 'none'`).
 * Use when inserting multiple dated rows for a renewing workshop.
 */
export function buildMaterializedEventRows<T extends Record<string, unknown>>(
  base: T,
  recurrence: 'daily' | 'weekly',
  options?: MaterializeDateOptions
): Array<T & { date: string; recurrence: 'none' }> {
  const raw = base.date
  const dateStr =
    typeof raw === 'string' ? raw : raw != null && raw !== '' ? String(raw) : null
  if (!dateStr) return []
  const baseDate = new Date(dateStr)
  if (Number.isNaN(baseDate.getTime())) return []
  const dates = getMaterializedInstanceDates(
    baseDate,
    recurrence,
    recurrence === 'daily'
      ? { dailyWeekdays: options?.dailyWeekdays ?? ALL_JS_WEEKDAYS }
      : undefined
  )
  return dates.map((iso) => ({ ...base, date: iso, recurrence: 'none' })) as Array<
    T & { date: string; recurrence: 'none' }
  >
}

/** Clone a DB row for INSERT (drops id / timestamps). */
export function stripEventRowForInsert(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (!READ_ONLY_INSERT_KEYS.has(k)) out[k] = v
  }
  return out
}

