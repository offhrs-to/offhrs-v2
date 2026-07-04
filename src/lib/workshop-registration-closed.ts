import {
  findOccurrenceIndexByStart,
  getSeriesMode,
  isMultiWeekEvent,
  parseSeriesOccurrences,
  type EventSeriesFields,
} from '@/lib/workshop-series'

export type WorkshopBookingGateFields = EventSeriesFields & {
  registration_closed?: boolean | null
}

/** Whether registration is closed for a specific session (event-level or per-occurrence). */
export function isRegistrationClosedForSession(
  event: WorkshopBookingGateFields,
  sessionStartsAt?: string | null
): boolean {
  if (event.registration_closed) return true
  if (!isMultiWeekEvent(event)) return false
  if (getSeriesMode(event) === 'cohort') return false

  const start = sessionStartsAt?.trim()
  if (!start) return false

  const series = parseSeriesOccurrences(event)
  const idx = findOccurrenceIndexByStart(series, start)
  if (idx < 0) return false
  return series[idx]?.registration_closed === true
}

/** Why a SaaS workshop cannot be booked (consumer checkout). */
export function workshopBookingBlockReason(
  event: WorkshopBookingGateFields,
  sessionStartsAt?: string | null
): string | null {
  if (isRegistrationClosedForSession(event, sessionStartsAt)) {
    return 'Registration is closed for this workshop'
  }
  if (event.booking_status === 'fully_booked') {
    return 'This session is fully booked'
  }
  if (event.booking_status !== 'published') {
    return 'This session is not available for booking'
  }
  if ((event.available_slots ?? 0) <= 0) {
    return 'No spots remaining'
  }
  return null
}

/** User-facing note for My Bookings when the vendor closed registration. */
export function registrationClosedConsumerNote(
  event: WorkshopBookingGateFields,
  sessionStartsAt?: string | null
): string | null {
  return isRegistrationClosedForSession(event, sessionStartsAt)
    ? 'Registration closed — your booking is still valid'
    : null
}
