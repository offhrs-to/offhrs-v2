import {
  mapDbRowToWorkshopEvent,
  WORKSHOP_EVENT_LIST_SELECT,
  type WorkshopEventDbRow,
  type WorkshopEventRow,
} from '@/lib/workshops-events-query';
import { enrichWorkshopEventsWithVendorNames } from '@/lib/workshop-vendor-display';
import {
  isBookingCancellableNow,
  refundWindowBlockedMessage,
} from '@/lib/booking-refund-eligibility';
import { workshopIsSaasVendorEvent } from '@/lib/workshop-event-utils';
import { supabase } from '@/lib/supabase';

const TORONTO_TZ = 'America/Toronto';

export type UserBookingStatusKind = 'confirmed' | 'past' | 'refunded' | 'pending';

export type UserBookingListItem = {
  bookingId: string;
  statusLabel: string;
  statusKind: UserBookingStatusKind;
  title: string;
  dateLine: string;
  timeDurationLine: string;
  location: string;
  startIso: string;
  event: WorkshopEventRow;
  /** SaaS in-app booking that can be cancelled by the user. */
  canRequestRefund: boolean;
  refundWindowHours: number | null;
  cancelBlockedMessage: string | null;
};

type BookingRow = {
  id: string;
  event_id: number;
  status: string | null;
  created_at: string;
  session_starts_at: string | null;
  refunded_at: string | null;
};

function formatDateLine(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: TORONTO_TZ,
    });
  } catch {
    return '';
  }
}

function formatTimeLine(iso: string, durationMinutes: number | null): string {
  try {
    const time = new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: TORONTO_TZ,
    });
    if (durationMinutes != null && durationMinutes > 0) {
      return `${time} · ${durationMinutes} min`;
    }
    return time;
  } catch {
    return durationMinutes != null && durationMinutes > 0 ? `${durationMinutes} min` : '';
  }
}

function resolveBookingStatus(
  booking: BookingRow,
  event: WorkshopEventRow,
  workshopStartIso: string
): { kind: UserBookingStatusKind; label: string } {
  if (booking.status === 'refunded' || booking.refunded_at) {
    return { kind: 'refunded', label: 'Refunded' };
  }
  if (booking.status === 'pending_confirmation' || booking.status === 'pending') {
    return { kind: 'pending', label: 'Pending' };
  }
  const startMs = new Date(workshopStartIso).getTime();
  const isPast = !Number.isNaN(startMs) && startMs < Date.now();
  if (isPast || event.booking_status === 'archived') {
    return { kind: 'past', label: 'Past' };
  }
  if (
    booking.status === 'confirmed' ||
    booking.status === 'booked' ||
    booking.status === 'attended'
  ) {
    return { kind: 'confirmed', label: 'Confirmed' };
  }
  return { kind: 'confirmed', label: 'Confirmed' };
}

function compareByWorkshopStart(a: UserBookingListItem, b: UserBookingListItem): number {
  const aMs = new Date(a.startIso).getTime();
  const bMs = new Date(b.startIso).getTime();
  const now = Date.now();
  const aUpcoming = !Number.isNaN(aMs) && aMs >= now;
  const bUpcoming = !Number.isNaN(bMs) && bMs >= now;
  if (aUpcoming && bUpcoming) return aMs - bMs;
  if (aUpcoming) return -1;
  if (bUpcoming) return 1;
  return bMs - aMs;
}

/**
 * All bookings for the signed-in user (confirmed, past/archived workshops, refunded).
 */
export async function fetchUserBookings(userId: string): Promise<UserBookingListItem[]> {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, event_id, status, created_at, session_starts_at, refunded_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !bookings?.length) {
    return [];
  }

  const eventIds = [...new Set(bookings.map((b) => b.event_id).filter((id) => id != null))];
  const { data: events } = await supabase
    .from('events')
    .select(WORKSHOP_EVENT_LIST_SELECT)
    .in('id', eventIds);

  if (!events?.length) {
    return [];
  }

  const mappedEvents = (events as WorkshopEventDbRow[]).map((row) => mapDbRowToWorkshopEvent(row));
  const enrichedEvents = await enrichWorkshopEventsWithVendorNames(mappedEvents);
  const eventById = new Map(enrichedEvents.map((row) => [row.id, row]));

  const vendorProfileIds = [
    ...new Set(
      enrichedEvents
        .map((e) => e.vendor_profile_id?.trim())
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const refundHoursByVendorId: Record<string, number> = {};
  if (vendorProfileIds.length > 0) {
    const { data: vendors } = await supabase
      .from('vendor_profiles')
      .select('id, refund_window_hours')
      .in('id', vendorProfileIds);
    for (const v of vendors ?? []) {
      if (v.id) refundHoursByVendorId[v.id] = Number(v.refund_window_hours ?? 48);
    }
  }

  const items: UserBookingListItem[] = [];

  for (const booking of bookings as BookingRow[]) {
    const event = eventById.get(booking.event_id);
    if (!event) continue;

    const startIso =
      booking.session_starts_at?.trim() || event.date_iso?.trim() || booking.created_at;
    const { kind, label } = resolveBookingStatus(booking, event, startIso);

    const isSaas = workshopIsSaasVendorEvent(event);
    const refundWindowHours = event.vendor_profile_id
      ? (refundHoursByVendorId[event.vendor_profile_id] ?? 48)
      : null;
    const window =
      refundWindowHours != null
        ? isBookingCancellableNow({
            sessionStartsAt: booking.session_starts_at,
            eventDateIso: event.date_iso,
            refundWindowHours,
          })
        : null;
    const canRequestRefund =
      isSaas &&
      kind === 'confirmed' &&
      (booking.status === 'confirmed' || booking.status === 'booked') &&
      (window?.cancellable ?? false);
    const cancelBlockedMessage =
      isSaas && kind === 'confirmed' && window && !window.cancellable
        ? refundWindowBlockedMessage(window.minWindowHours)
        : null;

    items.push({
      bookingId: booking.id,
      statusLabel: label,
      statusKind: kind,
      title: event.title || 'Workshop',
      dateLine: formatDateLine(startIso),
      timeDurationLine: formatTimeLine(startIso, event.duration_minutes),
      location: event.location?.trim() || 'Location TBA',
      startIso,
      event,
      canRequestRefund,
      refundWindowHours,
      cancelBlockedMessage,
    });
  }

  items.sort(compareByWorkshopStart);
  return items;
}
