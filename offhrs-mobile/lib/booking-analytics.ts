/**
 * Lightweight client-side booking funnel logging.
 * Replace with Segment / Firebase / your pipeline when ready.
 */
export function logBookingAnalytics(
  phase: 'book_tap' | 'book_api_ok' | 'book_api_error' | 'payment_sheet_init_error' | 'payment_cancelled' | 'payment_success' | 'confirm_error' | 'confirm_success',
  payload: { eventId?: number; detail?: string }
): void {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.log(`[offhrs/booking] ${phase}`, payload);
}
