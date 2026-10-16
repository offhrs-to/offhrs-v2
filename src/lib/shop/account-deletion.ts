import { SHOP_SNAD_RETURN_DAYS } from '@/lib/shop/fees'

export type ShopOrderDeletionAction = 'refund' | 'block' | 'anonymize'

export type ShopOrderDeletionBlockReason =
  | 'awaiting_pickup'
  | 'in_transit'
  | 'claim_window'
  | 'open_claim'
  | 'dispute'

export type ShopOrderForAccountDeletion = {
  id: string
  status: string
  fulfillment_type: string
  first_scan_at: string | null
  delivered_at: string | null
  picked_up_at: string | null
  stripe_dispute_id?: string | null
  product_title?: string | null
}

export type ShopOrderDeletionDecision = {
  orderId: string
  productTitle: string
  action: ShopOrderDeletionAction
  blockReason?: ShopOrderDeletionBlockReason
}

const TERMINAL_ANONYMIZE = new Set(['refunded', 'cancelled'])
const OPEN_CLAIM_STATUSES = new Set(['open', 'seller_responded'])

export function isOpenShopClaimStatus(status: string | null | undefined): boolean {
  return OPEN_CLAIM_STATUSES.has((status ?? '').toLowerCase())
}

function withinSnadWindow(anchorIso: string | null | undefined, nowMs = Date.now()): boolean {
  if (!anchorIso) return false
  const anchor = new Date(anchorIso).getTime()
  if (!Number.isFinite(anchor)) return false
  return nowMs <= anchor + SHOP_SNAD_RETURN_DAYS * 24 * 60 * 60 * 1000
}

/**
 * Hybrid consumer account-deletion policy for Marketplace orders:
 * - Not shipped yet (ship, pre–First Scan) → refund, then anonymize
 * - Awaiting pickup / in transit / 14-day claim window / open claim / dispute → block
 * - Delivered or picked up and quiet → anonymize
 */
export function classifyShopOrderForAccountDeletion(
  order: ShopOrderForAccountDeletion,
  options: { hasOpenClaim?: boolean; nowMs?: number } = {}
): ShopOrderDeletionDecision {
  const nowMs = options.nowMs ?? Date.now()
  const status = (order.status ?? '').toLowerCase()
  const productTitle = order.product_title?.trim() || 'Marketplace order'
  const base = { orderId: order.id, productTitle }

  if (TERMINAL_ANONYMIZE.has(status)) {
    return { ...base, action: 'anonymize' }
  }

  if (status === 'disputed' || order.stripe_dispute_id) {
    return { ...base, action: 'block', blockReason: 'dispute' }
  }

  if (options.hasOpenClaim) {
    return { ...base, action: 'block', blockReason: 'open_claim' }
  }

  const fulfilledAt = order.delivered_at || order.picked_up_at
  if (fulfilledAt) {
    if (withinSnadWindow(fulfilledAt, nowMs)) {
      return { ...base, action: 'block', blockReason: 'claim_window' }
    }
    return { ...base, action: 'anonymize' }
  }

  if (order.fulfillment_type === 'pickup') {
    return { ...base, action: 'block', blockReason: 'awaiting_pickup' }
  }

  // Ship: First Scan means the parcel is with the carrier.
  if (order.first_scan_at) {
    return { ...base, action: 'block', blockReason: 'in_transit' }
  }

  if (status === 'shipped') {
    return { ...base, action: 'block', blockReason: 'in_transit' }
  }

  // Paid / label purchased, not yet scanned → refund like an upcoming workshop.
  if (['paid_awaiting_fulfillment', 'label_purchased'].includes(status)) {
    return { ...base, action: 'refund' }
  }

  // Unknown non-terminal state — safer to block than wipe PII mid-fulfillment.
  return { ...base, action: 'block', blockReason: 'in_transit' }
}

export function shopOrderDeletionBlockMessage(decisions: ShopOrderDeletionDecision[]): string {
  const blocked = decisions.filter((d) => d.action === 'block')
  if (blocked.length === 0) return ''

  const reasonLine = (reason: ShopOrderDeletionBlockReason | undefined): string => {
    switch (reason) {
      case 'awaiting_pickup':
        return 'is waiting for pickup'
      case 'in_transit':
        return 'is still in transit'
      case 'claim_window':
        return `is still inside the ${SHOP_SNAD_RETURN_DAYS}-day delivery claim window`
      case 'open_claim':
        return 'has an open damaged / not-as-described claim'
      case 'dispute':
        return 'has an open payment dispute'
      default:
        return 'is still active'
    }
  }

  if (blocked.length === 1) {
    const only = blocked[0]!
    return (
      `You can't delete your account yet because your order "${only.productTitle}" ${reasonLine(only.blockReason)}. ` +
      `Try again after that order is finished, or contact hello@offhrs.app for help.`
    )
  }

  const lines = blocked
    .slice(0, 3)
    .map((d) => `"${d.productTitle}" (${reasonLine(d.blockReason)})`)
    .join('; ')
  const more = blocked.length > 3 ? ` and ${blocked.length - 3} more` : ''
  return (
    `You can't delete your account yet because you still have active Marketplace orders: ${lines}${more}. ` +
    `Try again after those orders are finished, or contact hello@offhrs.app for help.`
  )
}

/** PII scrub for a finished / refunded Marketplace order. Keeps amounts, tax, and Stripe ids. */
export function shopOrderAnonymizePatch() {
  return {
    user_id: null,
    buyer_name: 'Deleted user',
    buyer_email: 'deleted@users.offhrs.invalid',
    ship_to_name: null,
    ship_to_line1: null,
    ship_to_line2: null,
    ship_to_city: null,
    ship_to_province: null,
    ship_to_postal_code: null,
  }
}
