/**
 * Which `events` rows appear on the consumer app / public workshop browse.
 * Partner "delete" sets booking_status to `archived` (row remains in DB).
 */

export type ConsumerEventVisibilityFields = {
  booking_status?: string | null
  vendor_profile_id?: string | null
}

export function isEventVisibleToConsumers(row: ConsumerEventVisibilityFields): boolean {
  const status = row.booking_status ?? null
  if (status === 'archived' || status === 'draft') return false
  if (status === 'published' || status === 'fully_booked') return true
  /** Legacy marketplace rows (pre-SaaS) often have null booking_status. */
  if (status == null && !row.vendor_profile_id) return true
  return false
}

/** PostgREST filter for Supabase client queries (published + fully_booked + legacy null). */
export const CONSUMER_BOOKING_STATUS_OR =
  'booking_status.eq.published,booking_status.eq.fully_booked,and(booking_status.is.null,vendor_profile_id.is.null)'
