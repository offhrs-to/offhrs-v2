import 'server-only'

import type Stripe from 'stripe'

export type ChargeFeeBreakdown = {
  /** Total Stripe processing fee in CAD (real, from balance transaction). */
  feeCad: number
  /** Net amount the connected account receives in CAD (charge total minus fee). */
  netCad: number
  /** The balance_transaction id used to derive the values, if any. */
  balanceTransactionId: string | null
}

/**
 * Estimate Stripe processing fee for a CA-domestic card. Used as a fallback
 * when the balance_transaction isn't available yet (e.g., immediately after
 * a `succeeded` PaymentIntent in test mode).
 *
 * Real fees can be HIGHER for cross-border, currency-conversion, premium card,
 * or international transactions, so callers should always reconcile against
 * the balance_transaction once it's published.
 */
export function estimateCanadianStripeFee(amountCad: number): ChargeFeeBreakdown {
  const safeAmount = Math.max(0, Number.isFinite(amountCad) ? amountCad : 0)
  const fee = Math.round((safeAmount * 0.029 + 0.30) * 100) / 100
  const net = Math.round((safeAmount - fee) * 100) / 100
  return { feeCad: fee, netCad: net, balanceTransactionId: null }
}

/**
 * Fetch the real Stripe processing fee + net for a charge by retrieving its
 * balance_transaction. Returns null when the balance_transaction isn't
 * available yet (Stripe creates it asynchronously); the caller should fall
 * back to {@link estimateCanadianStripeFee} and rely on the `charge.updated`
 * webhook to reconcile later.
 *
 * Important: when the PaymentIntent was created with `on_behalf_of` set to
 * the connected account, the connected account is the settlement merchant,
 * which means the balance_transaction lives on THAT account — not the
 * platform. Always pass `connectedAccountId` so we read from the right ledger.
 *
 * @see https://docs.stripe.com/connect/destination-charges#settlement-merchant
 */
export async function fetchRealChargeFee(
  stripe: Stripe,
  chargeId: string,
  connectedAccountId: string
): Promise<ChargeFeeBreakdown | null> {
  try {
    const charge = await stripe.charges.retrieve(
      chargeId,
      { expand: ['balance_transaction'] },
      { stripeAccount: connectedAccountId }
    )
    const bt = charge.balance_transaction
    if (!bt || typeof bt === 'string') return null
    if (bt.fee == null || bt.net == null) return null
    return {
      feeCad: bt.fee / 100,
      netCad: bt.net / 100,
      balanceTransactionId: bt.id,
    }
  } catch (err) {
    console.warn(
      'fetchRealChargeFee: could not retrieve balance_transaction',
      chargeId,
      err instanceof Error ? err.message : err
    )
    return null
  }
}
