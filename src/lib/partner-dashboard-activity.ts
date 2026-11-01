import { buildTorontoDaySequence, getTorontoYmd } from '@/lib/workshop-timezone'

export type ActivityDayPoint = {
  /** America/Toronto calendar day yyyy-MM-dd */
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

/** @deprecated Prefer buildTorontoDaySequence — kept as alias for call sites. */
export function buildUtcDaySequence(numDays: number): string[] {
  return buildTorontoDaySequence(numDays)
}

function dayLabelToronto(yyyyMmDd: string): string {
  try {
    const [y, m, d] = yyyyMmDd.split('-').map(Number)
    // Noon UTC on that civil date is unambiguous for month/day labels.
    const probe = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0))
    return probe.toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return yyyyMmDd
  }
}

function torontoDayFromIso(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return getTorontoYmd(d)
}

/**
 * Bucket partner bookings into daily counts (America/Toronto calendar days).
 * - bookings: real booking creates (confirmed/pending/booked/pending_confirmation/attended)
 *   by created_at day — including rows later refunded (so completed + refunded activity stays visible)
 * - churn: refunded (by refunded_at day, else created_at) + cancelled (by created_at)
 */
export function buildActivitySeriesFromBookings(
  rows: BookingActivityRow[],
  numDays: number
): ActivityDayPoint[] {
  const dayKeys = buildTorontoDaySequence(numDays)
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
    const createDay = torontoDayFromIso(b.created_at)

    // Booking volume by create day (refunded bookings still count as activity that day).
    if (isRefunded || BOOKING_STATUSES.has(st)) {
      if (createDay && set.has(createDay)) counts.get(createDay)!.bookings += 1
    }

    if (isRefunded) {
      const d = torontoDayFromIso(b.refunded_at ?? b.created_at)
      if (d && set.has(d)) counts.get(d)!.churn += 1
    } else if (st === 'cancelled') {
      if (createDay && set.has(createDay)) counts.get(createDay)!.churn += 1
    }
  }

  return dayKeys.map((date) => {
    const c = counts.get(date)!
    return {
      date,
      label: dayLabelToronto(date),
      bookings: c.bookings,
      churn: c.churn,
    }
  })
}
