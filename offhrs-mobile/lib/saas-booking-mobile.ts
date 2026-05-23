import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';

import { BOOK_API_BASE } from '@/constants/api';
import { bookingApiErrorMessage, buildBookingApiHeaders } from '@/lib/booking-api-headers';
import { logBookingAnalytics } from '@/lib/booking-analytics';
import { supabase } from '@/lib/supabase';

export type BookPaidResult =
  | { ok: true }
  | { ok: false; cancelled?: boolean; message: string };

/** Legacy `/api/book` body (redirect + optional `bookings` row). */
export async function postLegacyBookTap(eventId: number, eventTitle: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = await buildBookingApiHeaders(session?.access_token);
  await fetch(`${BOOK_API_BASE}/api/book`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ event_id: eventId, event_title: eventTitle }),
  }).catch(() => {});
}

/**
 * SaaS path: `/api/book` → Payment Sheet → `/api/book/confirm`.
 * Requires signed-in user with email (Stripe customer + PaymentIntent).
 */
export type CustomerAddressForTax = {
  postal_code: string;
  state?: string;
  country?: string;
  city?: string;
  line1?: string;
};

export async function runPaidWorkshopBooking(params: {
  eventId: number;
  attendeeName: string;
  attendeeEmail: string;
  startTimeIso?: string | null;
  customerAddress?: CustomerAddressForTax | null;
}): Promise<BookPaidResult> {
  logBookingAnalytics('book_tap', { eventId: params.eventId });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, message: 'Sign in to book and pay in the app.' };
  }

  if (!params.attendeeEmail.trim()) {
    return { ok: false, message: 'Your account needs an email address to book.' };
  }

  const headers = await buildBookingApiHeaders(session.access_token);

  const bookRes = await fetch(`${BOOK_API_BASE}/api/book`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      event_id: params.eventId,
      attendee_name: params.attendeeName.trim(),
      attendee_email: params.attendeeEmail.trim(),
      start_time: params.startTimeIso?.trim() || undefined,
      ...(params.customerAddress
        ? {
            customer_address: {
              country: params.customerAddress.country ?? 'CA',
              postal_code: params.customerAddress.postal_code,
              state: params.customerAddress.state,
              city: params.customerAddress.city,
              line1: params.customerAddress.line1,
            },
          }
        : {}),
    }),
  });

  const bookData = (await bookRes.json().catch(() => ({}))) as Record<string, unknown>;

  if (!bookRes.ok) {
    const msg = bookingApiErrorMessage(bookRes.status, bookData.error as string | undefined);
    logBookingAnalytics('book_api_error', { eventId: params.eventId, detail: msg });
    return { ok: false, message: msg };
  }

  if (bookData.free === true) {
    logBookingAnalytics('book_api_ok', { eventId: params.eventId, detail: 'free' });
    const confRes = await fetch(`${BOOK_API_BASE}/api/book/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        free: true,
        event_id: String(params.eventId),
        attendee_name: params.attendeeName.trim(),
        attendee_email: params.attendeeEmail.trim(),
        startTime: params.startTimeIso?.trim() || undefined,
      }),
    });
    const confData = (await confRes.json().catch(() => ({}))) as { error?: string };
    if (!confRes.ok) {
      logBookingAnalytics('confirm_error', { eventId: params.eventId, detail: confData.error });
      return { ok: false, message: confData.error ?? 'Could not confirm free booking.' };
    }
    logBookingAnalytics('confirm_success', { eventId: params.eventId, detail: 'free' });
    return { ok: true };
  }

  const clientSecret = bookData.clientSecret as string | undefined;
  const paymentIntentId = bookData.paymentIntentId as string | undefined;

  if (!clientSecret || !paymentIntentId) {
    const msg = (bookData.error as string) || 'Invalid payment response';
    return { ok: false, message: msg };
  }

  logBookingAnalytics('book_api_ok', { eventId: params.eventId, detail: 'paid_pi_created' });

  if (Platform.OS === 'web') {
    return { ok: false, message: 'Use the iOS or Android app to complete payment.' };
  }

  const returnURL = Linking.createURL('stripe-redirect');

  const { error: initError } = await initPaymentSheet({
    merchantDisplayName: 'Offhrs',
    paymentIntentClientSecret: clientSecret,
    defaultBillingDetails: {
      name: params.attendeeName.trim(),
      email: params.attendeeEmail.trim(),
    },
    returnURL,
    applePay: Platform.OS === 'ios' ? { merchantCountryCode: 'CA' } : undefined,
    googlePay:
      Platform.OS === 'android'
        ? {
            merchantCountryCode: 'CA',
            currencyCode: 'CAD',
            testEnv: __DEV__,
          }
        : undefined,
    allowsDelayedPaymentMethods: false,
  });

  if (initError) {
    logBookingAnalytics('payment_sheet_init_error', {
      eventId: params.eventId,
      detail: initError.message,
    });
    return { ok: false, message: initError.message ?? 'Could not open payment sheet' };
  }

  const { error: payError } = await presentPaymentSheet();

  if (payError) {
    if (payError.code === 'Canceled') {
      logBookingAnalytics('payment_cancelled', { eventId: params.eventId });
      return { ok: false, cancelled: true, message: 'Cancelled' };
    }
    logBookingAnalytics('confirm_error', { eventId: params.eventId, detail: payError.message });
    return { ok: false, message: payError.message ?? 'Payment failed' };
  }

  logBookingAnalytics('payment_success', { eventId: params.eventId });

  const confRes = await fetch(`${BOOK_API_BASE}/api/book/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      paymentIntentId,
      startTime: params.startTimeIso?.trim() || undefined,
    }),
  });
  const confData = (await confRes.json().catch(() => ({}))) as {
    error?: string;
    duplicate?: boolean;
  };
  if (!confRes.ok) {
    const msg = bookingApiErrorMessage(confRes.status, confData.error);
    logBookingAnalytics('confirm_error', { eventId: params.eventId, detail: msg });
    return {
      ok: false,
      message:
        confRes.status === 401
          ? msg
          : confData.error ??
            'Payment went through but booking could not be finalized. Contact support with your receipt.',
    };
  }

  logBookingAnalytics('confirm_success', {
    eventId: params.eventId,
    detail: confData.duplicate ? 'duplicate' : 'created',
  });
  return { ok: true };
}
