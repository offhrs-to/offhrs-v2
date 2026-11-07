/** Calendar quarter helpers (America/Toronto local dates) for CRA remittance reporting. */

export type CalendarQuarter = 1 | 2 | 3 | 4

export function torontoYmdParts(d = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  return { year, month, day }
}

export function currentTorontoQuarter(d = new Date()): { year: number; quarter: CalendarQuarter } {
  const { year, month } = torontoYmdParts(d)
  const quarter = (Math.ceil(month / 3) as CalendarQuarter)
  return { year, quarter }
}

/** Inclusive Toronto calendar range for a quarter, as ISO date bounds (UTC midday anchors). */
export function quarterDateRange(
  year: number,
  quarter: CalendarQuarter
): { startIso: string; endExclusiveIso: string; label: string } {
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = startMonth + 3
  const endYear = endMonth > 12 ? year + 1 : year
  const endMonthNorm = endMonth > 12 ? endMonth - 12 : endMonth
  const startIso = `${year}-${String(startMonth).padStart(2, '0')}-01T05:00:00.000Z` // ~midnight ET
  const endExclusiveIso = `${endYear}-${String(endMonthNorm).padStart(2, '0')}-01T05:00:00.000Z`
  const label = `Q${quarter} ${year}`
  return { startIso, endExclusiveIso, label }
}

export const PLATFORM_TAX_ACTIVE_STATUSES = [
  'paid_awaiting_fulfillment',
  'label_purchased',
  'shipped',
  'completed',
  'disputed',
] as const

export const PLATFORM_TAX_REFUNDED_STATUSES = ['refunded', 'cancelled'] as const
