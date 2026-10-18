/**
 * Cents of a Marketplace application fee to return to the connected account
 * on a pre-scan refund.
 *
 * The application fee bundles the 3% platform fee, shipping, tax (when
 * collected), and — when the platform pays Stripe — the card-processing
 * estimate. The vendor bears only that card fee, matching workshop refunds.
 * Everything else in the fee is returned so a cancelled order does not also
 * debit shipping, tax, or the platform fee.
 */
export function applicationFeeRefundCents(params: {
  applicationFeeCents: number
  alreadyRefundedCents: number
  stripeFeeToRetainCents: number
}): number {
  const fee = Math.max(0, Math.round(params.applicationFeeCents))
  const already = Math.max(0, Math.round(params.alreadyRefundedCents))
  const retain = Math.min(fee, Math.max(0, Math.round(params.stripeFeeToRetainCents)))
  const targetRefund = Math.max(0, fee - retain)
  return Math.max(0, targetRefund - already)
}
