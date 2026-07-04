import {
  findOccurrenceIndexByStart,
  getSeriesMode,
  isMultiWeekEvent,
  parseSeriesOccurrences,
  type EventSeriesFields,
} from '@/lib/workshop-series';

export type WorkshopRegistrationFields = EventSeriesFields & {
  registration_closed?: boolean | null;
};

export function isRegistrationClosedForSession(
  event: WorkshopRegistrationFields,
  sessionStartsAt?: string | null
): boolean {
  if (event.registration_closed) return true;
  if (!isMultiWeekEvent(event)) return false;
  if (getSeriesMode(event) === 'cohort') return false;

  const start = sessionStartsAt?.trim();
  if (!start) return false;

  const series = parseSeriesOccurrences(event);
  const idx = findOccurrenceIndexByStart(series, start);
  if (idx < 0) return false;
  return series[idx]?.registration_closed === true;
}

export function registrationClosedConsumerNote(
  event: WorkshopRegistrationFields,
  sessionStartsAt?: string | null
): string | null {
  return isRegistrationClosedForSession(event, sessionStartsAt)
    ? 'Registration closed — your booking is still valid'
    : null;
}
