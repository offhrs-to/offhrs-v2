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
import {
  formatFlexibleCancelDeadlineNote,
  STRICT_REFUND_MY_BOOKINGS_NOTE,
} from '@/lib/vendor-refund-policy';
import { workshopIsSaasVendorEvent } from '@/lib/workshop-event-utils';
import { registrationClosedConsumerNote } from '@/lib/workshop-registration-closed';
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
  /** Shown when the vendor closed registration but the booking remains valid. */
  registrationClosedNote: string | null;
  /** Strict or flexible cancellation reminder for upcoming bookings. */
  cancellationPolicyNote: string | null;
  /** SaaS partner booking — show Contact host action. */
  showContactHost: boolean;
  contactHostLegacyVendorId: string | null;
  contactHostVendorProfileId: string | null;
};

type BookingRow = {
  id: string;
  event_id: number;
  status: string | null;
  created_at: string;
  session_starts_at: string | null;
  refunded_at: string | null;
  amount_cad: number | null;
  total_cad: number | null;
  stripe_payment_intent_id: string | null;
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
 * Matches by user_id and by attendee email (SaaS rows may have been created before user_id was set).
 */
export async function fetchUserBookings(
  userId: string,
  userEmail?: string | null
): Promise<UserBookingListItem[]> {
  const email = userEmail?.trim();
  let bookingsQuery = supabase
    .from('bookings')
    .select(
      'id, event_id, status, created_at, session_starts_at, refunded_at, amount_cad, total_cad, stripe_payment_intent_id'
    )
    .order('created_at', { ascending: false });

  if (email) {
    bookingsQuery = bookingsQuery.or(`user_id.eq.${userId},email.eq.${email}`);
  } else {
    bookingsQuery = bookingsQuery.eq('user_id', userId);
  }

  const { data: bookings, error } = await bookingsQuery;

  if (error || !bookings?.length) {
    return [];
  }

  const eventIds = [...new Set(bookings.map((b) => b.event_id).filter((id) => id != null))];
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select(WORKSHOP_EVENT_LIST_SELECT)
    .in('id', eventIds);

  if (eventsError || !events?.length) {
    if (eventsError && __DEV__) {
      console.warn('fetchUserBookings: events load failed', eventsError.message);
    }
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
  const strictNoRefundByVendorId: Record<string, boolean> = {};
  if (vendorProfileIds.length > 0) {
    const { data: vendors } = await supabase
      .from('vendor_profiles')
      .select('id, refund_window_hours, strict_no_refund')
      .in('id', vendorProfileIds);
    for (const v of vendors ?? []) {
      if (v.id) {
        refundHoursByVendorId[v.id] = Number(v.refund_window_hours ?? 48);
        strictNoRefundByVendorId[v.id] = v.strict_no_refund === true;
      }
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
    const vendorProfileId = event.vendor_profile_id?.trim() ?? null;
    const strictNoRefund = vendorProfileId ? strictNoRefundByVendorId[vendorProfileId] === true : false;
    const chargeCad =
      booking.total_cad != null && Number(booking.total_cad) > 0
        ? Number(booking.total_cad)
        : Number(booking.amount_cad ?? 0);
    const isPaidBooking = chargeCad > 0 || Boolean(booking.stripe_payment_intent_id?.trim());
    const refundWindowHours = vendorProfileId
      ? (refundHoursByVendorId[vendorProfileId] ?? 48)
      : null;
    const window =
      refundWindowHours != null && !strictNoRefund
        ? isBookingCancellableNow({
            sessionStartsAt: booking.session_starts_at,
            eventDateIso: event.date_iso,
            refundWindowHours,
          })
        : null;

    let canRequestRefund = false;
    let cancelBlockedMessage: string | null = null;
    let cancellationPolicyNote: string | null = null;

    if (
      isSaas &&
      kind === 'confirmed' &&
      (booking.status === 'confirmed' || booking.status === 'booked')
    ) {
      if (strictNoRefund && isPaidBooking) {
        cancellationPolicyNote = STRICT_REFUND_MY_BOOKINGS_NOTE;
      } else if (window?.cancellable) {
        canRequestRefund = true;
        cancellationPolicyNote = formatFlexibleCancelDeadlineNote(startIso, window.minWindowHours);
      } else if (window && !window.cancellable) {
        cancelBlockedMessage = refundWindowBlockedMessage(window.minWindowHours);
      }
    }

    const showContactHost =
      isSaas &&
      (kind === 'confirmed' || kind === 'pending') &&
      Boolean(event.vendor_id?.trim() || vendorProfileId);

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
      registrationClosedNote:
        kind === 'confirmed' || kind === 'pending'
          ? registrationClosedConsumerNote(event, booking.session_starts_at ?? startIso)
          : null,
      cancellationPolicyNote,
      showContactHost,
      contactHostLegacyVendorId: event.vendor_id?.trim() ?? null,
      contactHostVendorProfileId: vendorProfileId,
    });
  }

  items.sort(compareByWorkshopStart);
  return items;
}
