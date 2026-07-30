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
 * - bookings: real booking creates (confirmed/pending/booked/pending_confirmation/attended)
 *   by created_at day — including rows later refunded (so completed + refunded activity stays visible)
 * - churn: refunded (by refunded_at day, else created_at) + cancelled (by created_at)
 */
export function buildActivitySeriesFromBookings(
  rows: BookingActivityRow[],
  numDays: number
): ActivityDayPoint[] {
  const dayKeys = buildUtcDaySequence(numDays)
  const set = new Set(dayKeys)
  const counts = new Map(dayKeys.map((k) => [k, { bookings: 0, churn: 0 }]))

  const BOOKING_STATUSES = new Set([
    'confirmed',
    'pending',
    'booked',
    'pending_confirmation',
    'attended',
  ])

  for (const b of rows) {
    const st = (b.status ?? '').toLowerCase()
    const isRefunded = st === 'refunded' || Boolean(b.refunded_at)
    const createDay = typeof b.created_at === 'string' ? b.created_at.slice(0, 10) : ''

    // Booking volume by create day (refunded bookings still count as activity that day).
    if (isRefunded || BOOKING_STATUSES.has(st)) {
      if (createDay && set.has(createDay)) counts.get(createDay)!.bookings += 1
    }

    if (isRefunded) {
      const raw = b.refunded_at ?? b.created_at
      const d = typeof raw === 'string' ? raw.slice(0, 10) : ''
      if (d && set.has(d)) counts.get(d)!.churn += 1
    } else if (st === 'cancelled') {
      if (createDay && set.has(createDay)) counts.get(createDay)!.churn += 1
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
