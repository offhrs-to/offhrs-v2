import { findOccurrenceIndexByStart, type SeriesOccurrence } from '@/lib/workshop-series'

export type BookingRowForAvailability = {
  session_starts_at: string | null
  refunded_at?: string | null
}

/** Cohort series share a single capacity across all sessions: count active bookings once. */
export function countActiveCohortBookings(bookings: BookingRowForAvailability[]): number {
  return bookings.filter((b) => !b.refunded_at).length
}

/** Count active (non-refunded) offhrs bookings per occurrence start time. */
export function countBookingsPerOccurrence(
  bookings: BookingRowForAvailability[],
  occurrenceStartsIso: string[]
): number[] {
  const counts = occurrenceStartsIso.map(() => 0)
  if (occurrenceStartsIso.length === 0) return counts

  const seriesStub = occurrenceStartsIso.map((start) => ({
    start,
    max_attendees: 1,
    available_slots: 1,
  }))

  for (const b of bookings) {
    if (b.refunded_at) continue
    const fallback = occurrenceStartsIso[0] ?? ''
    const candidate = String(b.session_starts_at ?? fallback).trim() || fallback
    const idx = findOccurrenceIndexByStart(seriesStub, candidate)
    if (idx >= 0 && idx < counts.length) counts[idx] += 1
  }
  return counts
}

/** After structural merge, set availability from capacity rules. */
export function setSeriesAvailabilityFromRules(
  occ: SeriesOccurrence[],
  externalPerOccurrence: number,
  bookedPerOcc: number[]
): SeriesOccurrence[] {
  return occ.map((o, i) => {
    const ext = Math.max(0, externalPerOccurrence)
    const booked = bookedPerOcc[i] ?? 0
    return {
      ...o,
      available_slots: Math.max(0, o.max_attendees - ext - booked),
      max_attendees: o.max_attendees,
    }
  })
}
