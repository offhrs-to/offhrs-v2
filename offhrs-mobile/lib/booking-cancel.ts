import { BOOK_API_BASE } from '@/constants/api';
import { bookingApiErrorMessage, buildBookingApiHeaders } from '@/lib/booking-api-headers';
import {
  formatFlexibleRefundPolicyLine,
  STRICT_REFUND_POLICY_LINE,
  type ConsumerRefundPolicyDisplay,
} from '@/lib/vendor-refund-policy';

export type { ConsumerRefundPolicyDisplay };

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

function parseConsumerRefundPolicyDisplay(data: Record<string, unknown>): ConsumerRefundPolicyDisplay {
  const strictNoRefund = data.strictNoRefund === true;
  const refundWindowHours =
    typeof data.refundWindowHours === 'number' ? data.refundWindowHours : null;
  const policyLine =
    (typeof data.policyLine === 'string' ? data.policyLine : null) ??
    (typeof data.refundPolicyLine === 'string' ? data.refundPolicyLine : null) ??
    (strictNoRefund
      ? STRICT_REFUND_POLICY_LINE
      : formatFlexibleRefundPolicyLine(refundWindowHours ?? 48));

  return {
    strictNoRefund,
    refundWindowHours,
    badge: typeof data.badge === 'string' ? data.badge : strictNoRefund ? 'Non-refundable' : null,
    policyLine,
    policyHeadline:
      typeof data.policyHeadline === 'string'
        ? data.policyHeadline
        : strictNoRefund
          ? 'Strict Policy'
          : null,
    summary: typeof data.summary === 'string' ? data.summary : null,
    detailBullets: Array.isArray(data.detailBullets)
      ? data.detailBullets.filter((b): b is string => typeof b === 'string')
      : [],
    exceptionLine: typeof data.exceptionLine === 'string' ? data.exceptionLine : null,
    beforeBookLine: typeof data.beforeBookLine === 'string' ? data.beforeBookLine : null,
    platformFooter: typeof data.platformFooter === 'string' ? data.platformFooter : null,
    ackLabel: typeof data.ackLabel === 'string' ? data.ackLabel : null,
    myBookingsNote: typeof data.myBookingsNote === 'string' ? data.myBookingsNote : null,
    emailSummaryLine: typeof data.emailSummaryLine === 'string' ? data.emailSummaryLine : null,
  };
}

export async function fetchRefundPolicyForEvent(eventId: number): Promise<ConsumerRefundPolicyDisplay | null> {
  try {
    const res = await fetch(
      `${BOOK_API_BASE}/api/book/refund-policy?event_id=${encodeURIComponent(String(eventId))}`
    );
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return null;
    return parseConsumerRefundPolicyDisplay(data);
  } catch {
    return null;
  }
}
