import { TZDate } from '@date-fns/tz'
import { WORKSHOP_TIMEZONE } from '@/lib/workshop-timezone'

/** Default calendar window (weeks) for repeating workshops when the vendor doesn't override it. */
export const RENEW_INSTANCES_WEEKS = 4

/** Min/max weeks vendors can select for repeating workshops. */
export const REPEATING_WEEKS_MIN = 2
export const REPEATING_WEEKS_MAX = 12

/** JavaScript weekday indices (Date#getDay): 0 = Sun … 6 = Sat */
export const ALL_JS_WEEKDAYS = new Set<number>([0, 1, 2, 3, 4, 5, 6])

const READ_ONLY_INSERT_KEYS = new Set(['id', 'created_at', 'updated_at'])

function clampWeeks(weeks: number | undefined): number {
  if (!Number.isFinite(weeks ?? NaN)) return RENEW_INSTANCES_WEEKS
  return Math.max(REPEATING_WEEKS_MIN, Math.min(REPEATING_WEEKS_MAX, Math.floor(weeks!)))
}

function addWorkshopCalendarDays(base: Date, days: number): Date {
  const local = new TZDate(base.getTime(), WORKSHOP_TIMEZONE)
  return new TZDate(
    local.getFullYear(),
    local.getMonth(),
    local.getDate() + days,
    local.getHours(),
    local.getMinutes(),
    local.getSeconds(),
    WORKSHOP_TIMEZONE
  )
}

export type MaterializeDateOptions = {
  /** For daily recurrence: which weekdays (0–6) get an instance in the window */
  dailyWeekdays?: Set<number>
  /** Override the window length in weeks (defaults to RENEW_INSTANCES_WEEKS). */
  weeks?: number
}

/**
 * ISO date strings for each concrete event row to insert.
 * - Weekly: one occurrence per week (same weekday/time), spanning `weeks` weeks from the base date.
 * - Daily: each calendar day in a `weeks * 7`-day window from the base date whose weekday is in `dailyWeekdays`.
 */
export function getMaterializedInstanceDates(
  base: Date,
  recurrence: 'daily' | 'weekly',
  options?: MaterializeDateOptions
): string[] {
  if (Number.isNaN(base.getTime())) return []

  const weeks = clampWeeks(options?.weeks)
  const out: string[] = []
  if (recurrence === 'weekly') {
    for (let i = 0; i < weeks; i++) {
      const d = addWorkshopCalendarDays(base, i * 7)
      out.push(d.toISOString())
    }
  } else {
    const days = weeks * 7
    const allowed = options?.dailyWeekdays ?? ALL_JS_WEEKDAYS
    if (allowed.size === 0) return []
    for (let i = 0; i < days; i++) {
      const d = addWorkshopCalendarDays(base, i)
      if (allowed.has(d.getDay())) {
        out.push(d.toISOString())
      }
    }
  }
  return out
}

/** How many daily instances fall in the window for the given start date, weekday filter, and weeks span. */
export function countDailyInstancesInWindow(
  base: Date,
  weekdays: Set<number>,
  windowDays: number = RENEW_INSTANCES_WEEKS * 7
): number {
  if (Number.isNaN(base.getTime()) || weekdays.size === 0) return 0
  let c = 0
  for (let i = 0; i < windowDays; i++) {
    const d = addWorkshopCalendarDays(base, i)
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
    {
      weeks: options?.weeks,
      ...(recurrence === 'daily'
        ? { dailyWeekdays: options?.dailyWeekdays ?? ALL_JS_WEEKDAYS }
        : {}),
    }
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

const DATE_YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Calendar day key (YYYY-MM-DD) in America/Toronto. */
export function workshopDateYmdInToronto(instant: Date): string {
  const local = new TZDate(instant.getTime(), WORKSHOP_TIMEZONE)
  const y = local.getFullYear()
  const m = String(local.getMonth() + 1).padStart(2, '0')
  const d = String(local.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Build a TIMESTAMPTZ ISO string for a calendar day using the wall-clock time from `timeSource`
 * (both interpreted in America/Toronto).
 */
export function combineWorkshopDateYmdWithTime(dateYmd: string, timeSource: Date): string | null {
  const match = DATE_YMD_RE.exec(dateYmd.trim())
  if (!match || Number.isNaN(timeSource.getTime())) return null
  const time = new TZDate(timeSource.getTime(), WORKSHOP_TIMEZONE)
  const combined = new TZDate(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
    WORKSHOP_TIMEZONE
  )
  return combined.toISOString()
}

/** HH:mm (24h) on a Toronto calendar day → ISO instant. */
export function combineWorkshopDateYmdWithHhMm(dateYmd: string, hhMm: string): string | null {
  const match = DATE_YMD_RE.exec(dateYmd.trim())
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(hhMm.trim())
  if (!match || !timeMatch) return null
  const h = Number(timeMatch[1])
  const m = Number(timeMatch[2])
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  const combined = new TZDate(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    h,
    m,
    0,
    WORKSHOP_TIMEZONE
  )
  return combined.toISOString()
}

/** Dedupe HH:mm values and drop any that match the primary session time. */
export function normalizeExtraSessionTimesHhMm(
  raw: string[],
  primaryTimeSource?: Date | null
): string[] {
  let primaryHhMm: string | null = null
  if (primaryTimeSource && !Number.isNaN(primaryTimeSource.getTime())) {
    const t = new TZDate(primaryTimeSource.getTime(), WORKSHOP_TIMEZONE)
    primaryHhMm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
  }
  const out: string[] = []
  const seen = new Set<string>()
  if (primaryHhMm) seen.add(primaryHhMm)
  for (const rawT of raw) {
    const trimmed = rawT.trim()
    if (!trimmed) continue
    const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
    if (!timeMatch) continue
    const h = Number(timeMatch[1])
    const m = Number(timeMatch[2])
    if (h < 0 || h > 23 || m < 0 || m > 59) continue
    const norm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    if (seen.has(norm)) continue
    seen.add(norm)
    out.push(norm)
  }
  return out.sort()
}

/**
 * Duplicate each row with extra session times on the same calendar day (Toronto).
 * Primary time on each row is preserved; extras add more listings per day.
 */
export function expandEventRowsWithExtraSessionTimes<T extends Record<string, unknown> & { date: string }>(
  rows: T[],
  extraTimesHhMm: string[]
): Array<T & { date: string; recurrence: 'none'; is_multiple_dates: false }> {
  if (extraTimesHhMm.length === 0) {
    return rows.map((row) => ({
      ...row,
      recurrence: 'none' as const,
      is_multiple_dates: false as const,
    }))
  }

  const out: Array<T & { date: string; recurrence: 'none'; is_multiple_dates: false }> = []

  for (const row of rows) {
    const base = {
      ...row,
      recurrence: 'none' as const,
      is_multiple_dates: false as const,
    }
    const ymd = workshopDateYmdInToronto(new Date(row.date))
    const seen = new Set<string>()
    const primaryIso = new Date(row.date).toISOString()
    seen.add(primaryIso)
    out.push({ ...base, date: primaryIso })

    for (const hhMm of extraTimesHhMm) {
      const iso = combineWorkshopDateYmdWithHhMm(ymd, hhMm)
      if (iso && !seen.has(iso)) {
        seen.add(iso)
        out.push({ ...base, date: iso })
      }
    }
  }

  out.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return out
}

/**
 * One event row per selected calendar day (recurrence `none`), same payload as renew materialization.
 */
export function buildMaterializedEventRowsFromPickerDates<T extends Record<string, unknown>>(
  base: T,
  dateYmdList: Iterable<string>,
  timeSource: Date
): Array<T & { date: string; recurrence: 'none'; is_multiple_dates: false }> {
  const unique = [...new Set([...dateYmdList].map((d) => d.trim()).filter(Boolean))].sort()
  const rows: Array<T & { date: string; recurrence: 'none'; is_multiple_dates: false }> = []
  for (const ymd of unique) {
    const iso = combineWorkshopDateYmdWithTime(ymd, timeSource)
    if (iso) {
      rows.push({ ...base, date: iso, recurrence: 'none', is_multiple_dates: false })
    }
  }
  return rows
}

