/** Mirror of server refund window rules (platform minimum 24h). */

const PLATFORM_MIN_REFUND_HOURS = 24;

export function getEffectiveRefundWindowHours(vendorHours: number | null | undefined): number {
  return Math.max(vendorHours ?? 48, PLATFORM_MIN_REFUND_HOURS);
}

export function isBookingCancellableNow(params: {
  sessionStartsAt: string | null | undefined;
  eventDateIso: string | null | undefined;
  refundWindowHours: number | null | undefined;
}): { cancellable: boolean; minWindowHours: number; hoursUntilSession: number | null } {
  const minWindowHours = getEffectiveRefundWindowHours(params.refundWindowHours);
  const startIso = params.sessionStartsAt?.trim() || params.eventDateIso?.trim() || null;
  if (!startIso) {
    return { cancellable: true, minWindowHours, hoursUntilSession: null };
  }
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) {
    return { cancellable: true, minWindowHours, hoursUntilSession: null };
  }
  const hoursUntilSession = (start.getTime() - Date.now()) / (1000 * 60 * 60);
  return {
    cancellable: hoursUntilSession >= minWindowHours,
    minWindowHours,
    hoursUntilSession,
  };
}

export function refundWindowBlockedMessage(minWindowHours: number): string {
  return `Refunds are only available at least ${minWindowHours} hours before the session starts. Contact the host if you need help.`;
}

export function strictRefundBlockedMessage(): string {
  return 'This booking is non-refundable per the host’s strict cancellation policy. Contact the host if you need help.';
}
