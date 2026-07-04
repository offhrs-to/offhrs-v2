/** Keep in sync with src/lib/consumer-event-visibility.ts */

export type ConsumerEventVisibilityFields = {
  booking_status?: string | null;
  vendor_profile_id?: string | null;
  registration_closed?: boolean | null;
};

export function isEventVisibleToConsumers(row: ConsumerEventVisibilityFields): boolean {
  if (row.registration_closed) return false;
  const status = row.booking_status ?? null;
  if (status === 'archived' || status === 'draft') return false;
  if (status === 'published' || status === 'fully_booked') return true;
  if (status == null && !row.vendor_profile_id) return true;
  return false;
}

export const CONSUMER_BOOKING_STATUS_OR =
  'booking_status.eq.published,booking_status.eq.fully_booked,and(booking_status.is.null,vendor_profile_id.is.null)';
