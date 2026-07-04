/** Mirror of server cancellation policy copy for mobile UI. */

export const STRICT_REFUND_BADGE = 'Non-refundable'

export const STRICT_REFUND_POLICY_LINE =
  "This host's policy: no refunds after purchase."

export const STRICT_REFUND_SUMMARY =
  'This host applies a strict cancellation policy: paid bookings are non-refundable after purchase.'

export const STRICT_REFUND_BEFORE_BOOK_LINE =
  'Review the policy carefully before you pay. Last-minute changes are usually not eligible for a refund through the app.'

export const STRICT_REFUND_EXCEPTION_LINE =
  'If you have a serious emergency, contact the host directly to discuss options. The host—not offhrs—decides any exception.'

export const STRICT_REFUND_PLATFORM_FOOTER =
  'offhrs processes payments securely; cancellation terms are set by each host.'

export const STRICT_REFUND_ACK_LABEL = 'I understand this booking is non-refundable'

export const STRICT_REFUND_MY_BOOKINGS_NOTE =
  'Non-refundable — contact the host if you have an emergency'

export function formatFlexibleRefundPolicyLine(refundWindowHours: number): string {
  return `Free cancellation with full refund up to ${refundWindowHours} hours before the session starts.`
}

const TORONTO_TZ = 'America/Toronto'

/** Deadline for a full refund on flexible-policy bookings (My Bookings). */
export function formatFlexibleCancelDeadlineNote(
  sessionStartsAt: string,
  refundWindowHours: number
): string {
  const start = new Date(sessionStartsAt)
  if (Number.isNaN(start.getTime())) {
    return formatFlexibleRefundPolicyLine(refundWindowHours)
  }
  const deadline = new Date(start.getTime() - refundWindowHours * 60 * 60 * 1000)
  const deadlineStr = deadline.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TORONTO_TZ,
  })
  return `Cancel for a full refund until ${deadlineStr}`
}

export type ConsumerRefundPolicyDisplay = {
  strictNoRefund: boolean
  refundWindowHours: number | null
  badge: string | null
  policyLine: string
  policyHeadline: string | null
  summary: string | null
  detailBullets: string[]
  exceptionLine: string | null
  beforeBookLine: string | null
  platformFooter: string | null
  ackLabel: string | null
  myBookingsNote: string | null
  emailSummaryLine: string | null
}
