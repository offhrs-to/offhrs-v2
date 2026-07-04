const PLATFORM_MIN_REFUND_HOURS = 24

export const STRICT_REFUND_BADGE = 'Non-refundable'

export const STRICT_REFUND_POLICY_HEADLINE = 'Strict Policy'

/** Short discovery copy (Quick View badge companion line). */
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

export const STRICT_REFUND_CONSUMER_BLOCK_MESSAGE =
  'This booking is non-refundable per the host’s strict cancellation policy. Contact the host if you need help.'

/** @deprecated Use STRICT_REFUND_POLICY_LINE — kept for callers expecting the old combined line. */
export const STRICT_REFUND_POLICY_LINE_LEGACY =
  'Strict Policy: This booking is non-refundable once purchased.'

export type VendorRefundPolicyFields = {
  refund_window_hours?: number | null
  strict_no_refund?: boolean | null
}

export function isStrictNoRefundPolicy(vendor: VendorRefundPolicyFields): boolean {
  return vendor.strict_no_refund === true
}

export function formatFlexibleRefundPolicyLine(refundWindowHours: number): string {
  return `Free cancellation with full refund up to ${refundWindowHours} hours before the session starts.`
}

function effectiveRefundWindowHours(vendorRefundWindowHours: number | null | undefined): number {
  return Math.max(vendorRefundWindowHours ?? 48, PLATFORM_MIN_REFUND_HOURS)
}

export type ResolvedVendorRefundPolicy = {
  strictNoRefund: boolean
  refundWindowHours: number | null
  policyLine: string
  policyHeadline: string | null
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

export function buildConsumerRefundPolicyDisplay(
  vendor: VendorRefundPolicyFields
): ConsumerRefundPolicyDisplay {
  if (isStrictNoRefundPolicy(vendor)) {
    return {
      strictNoRefund: true,
      refundWindowHours: null,
      badge: STRICT_REFUND_BADGE,
      policyLine: STRICT_REFUND_POLICY_LINE,
      policyHeadline: null,
      summary: STRICT_REFUND_SUMMARY,
      detailBullets: [
        'Paid bookings are non-refundable after purchase.',
        STRICT_REFUND_BEFORE_BOOK_LINE,
        STRICT_REFUND_EXCEPTION_LINE,
      ],
      exceptionLine: STRICT_REFUND_EXCEPTION_LINE,
      beforeBookLine: STRICT_REFUND_BEFORE_BOOK_LINE,
      platformFooter: STRICT_REFUND_PLATFORM_FOOTER,
      ackLabel: STRICT_REFUND_ACK_LABEL,
      myBookingsNote: STRICT_REFUND_MY_BOOKINGS_NOTE,
      emailSummaryLine: STRICT_REFUND_SUMMARY,
    }
  }

  const refundWindowHours = effectiveRefundWindowHours(vendor.refund_window_hours)
  const policyLine = formatFlexibleRefundPolicyLine(refundWindowHours)

  return {
    strictNoRefund: false,
    refundWindowHours,
    badge: null,
    policyLine,
    policyHeadline: null,
    summary: null,
    detailBullets: [],
    exceptionLine: null,
    beforeBookLine: null,
    platformFooter: null,
    ackLabel: null,
    myBookingsNote: null,
    emailSummaryLine: policyLine,
  }
}

export function resolveVendorRefundPolicy(
  vendor: VendorRefundPolicyFields
): ResolvedVendorRefundPolicy {
  const display = buildConsumerRefundPolicyDisplay(vendor)
  return {
    strictNoRefund: display.strictNoRefund,
    refundWindowHours: display.refundWindowHours,
    policyLine: display.policyLine,
    policyHeadline: display.strictNoRefund ? STRICT_REFUND_POLICY_HEADLINE : null,
  }
}
