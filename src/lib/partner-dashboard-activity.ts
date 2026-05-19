import { format, parseISO } from 'date-fns'

export type ActivityDayPoint = {
  /** UTC calendar day yyyy-MM-dd */
  date: string
  label: string
  bookings: number
  churn: number
}

export type BookingActivityRow = {
  created_at: string
  status: string | null
  refunded_at: string | null
}

/** Oldest → newest UTC calendar days (inclusive of today). */
export function buildUtcDaySequence(numDays: number): string[] {
  const keys: string[] = []
  const now = Date.now()
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000)
    keys.push(d.toISOString().slice(0, 10))
  }
  return keys
}

function dayLabelUtc(yyyyMmDd: string): string {
  try {
    return format(parseISO(`${yyyyMmDd}T12:00:00.000Z`), 'MMM d')
  } catch {
    return yyyyMmDd
  }
}

/**
 * Bucket partner bookings into daily counts.
 * - bookings: confirmed + pending (by created_at day in range)
 * - churn: refunded (by refunded_at day, else created_at) + cancelled (by created_at)
 */
export function buildActivitySeriesFromBookings(
  rows: BookingActivityRow[],
  numDays: number
): ActivityDayPoint[] {
  const dayKeys = buildUtcDaySequence(numDays)
  const set = new Set(dayKeys)
  const counts = new Map(dayKeys.map((k) => [k, { bookings: 0, churn: 0 }]))

  for (const b of rows) {
    const st = (b.status ?? '').toLowerCase()
    const isRefunded = st === 'refunded' || Boolean(b.refunded_at)
    if (isRefunded) {
      const raw = b.refunded_at ?? b.created_at
      const d = typeof raw === 'string' ? raw.slice(0, 10) : ''
      if (d && set.has(d)) counts.get(d)!.churn += 1
    } else if (st === 'cancelled') {
      const d = b.created_at.slice(0, 10)
      if (set.has(d)) counts.get(d)!.churn += 1
    } else if (st === 'confirmed' || st === 'pending') {
      const d = b.created_at.slice(0, 10)
      if (set.has(d)) counts.get(d)!.bookings += 1
    }
  }

  return dayKeys.map((date) => {
    const c = counts.get(date)!
    return {
      date,
      label: dayLabelUtc(date),
      bookings: c.bookings,
      churn: c.churn,
    }
  })
}
