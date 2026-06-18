import { BOOK_API_BASE } from '@/constants/api';
import { bookingApiErrorMessage, buildBookingApiHeaders } from '@/lib/booking-api-headers';

export async function cancelUserBooking(params: {
  bookingId: string;
  accessToken: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const headers = await buildBookingApiHeaders(params.accessToken);
  const res = await fetch(`${BOOK_API_BASE}/api/bookings/${encodeURIComponent(params.bookingId)}/cancel`, {
    method: 'POST',
    headers,
  });
  const raw = await res.text().catch(() => '');
  let data: { error?: string } = {};
  try {
    data = raw ? (JSON.parse(raw) as { error?: string }) : {};
  } catch {
    /* HTML from Vercel protection or missing route */
  }
  if (!res.ok) {
    return {
      ok: false,
      message: bookingApiErrorMessage(res.status, data.error) || `Could not cancel booking (${res.status})`,
    };
  }
  return { ok: true };
}

export async function fetchRefundPolicyForEvent(eventId: number): Promise<{
  refundWindowHours: number;
  refundPolicyLine: string;
} | null> {
  try {
    const res = await fetch(
      `${BOOK_API_BASE}/api/book/refund-policy?event_id=${encodeURIComponent(String(eventId))}`
    );
    const data = (await res.json().catch(() => ({}))) as {
      refundWindowHours?: number;
      refundPolicyLine?: string;
    };
    if (!res.ok || data.refundWindowHours == null) return null;
    return {
      refundWindowHours: data.refundWindowHours,
      refundPolicyLine:
        data.refundPolicyLine ??
        `Free cancellation with full refund up to ${data.refundWindowHours} hours before the session starts.`,
    };
  } catch {
    return null;
  }
}
