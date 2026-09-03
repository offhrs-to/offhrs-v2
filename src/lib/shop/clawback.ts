import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

/** Stripe dispute fee passed through to sellers per Terms (~CAD $15). */
export const SHOP_DISPUTE_FEE_CAD = Number(process.env.SHOP_DISPUTE_FEE_CAD?.trim() || '15')

export type ClawbackKind = 'apv' | 'dispute'

export type ClawbackResult = {
  ok: boolean
  method: 'transfer_reversal' | 'account_debit' | 'none'
  transfer_reversal_id?: string
  charge_id?: string
  error?: string
}

/**
 * Recover funds from a Connect Express seller after APV shortfall or lost dispute.
 *
 * Strategy (destination charges):
 * 1. Reverse the PaymentIntent's transfer (preferred).
 * 2. Else debit the connected account via Charge with `source: connected_account`
 *    (requires account debiting enabled on the platform).
 */
export async function clawbackFromVendor(params: {
  stripe: Stripe
  connectedAccountId: string
  amountCad: number
  paymentIntentId: string
  idempotencyKey: string
  description: string
}): Promise<ClawbackResult> {
  const amountCents = Math.round(params.amountCad * 100)
  if (!(amountCents > 0)) {
    return { ok: false, method: 'none', error: 'Clawback amount must be positive' }
  }

  try {
    const pi = await params.stripe.paymentIntents.retrieve(params.paymentIntentId, {
      expand: ['latest_charge.transfer'],
    })
    const charge = pi.latest_charge
    const chargeObj = typeof charge === 'object' && charge ? charge : null
    const transferField = chargeObj && 'transfer' in chargeObj ? chargeObj.transfer : null
    const transferId =
      typeof transferField === 'string'
        ? transferField
        : transferField && typeof transferField === 'object' && 'id' in transferField
          ? String((transferField as { id: string }).id)
          : null

    if (transferId) {
      const reversal = await params.stripe.transfers.createReversal(
        transferId,
        {
          amount: amountCents,
          description: params.description,
          metadata: { idempotency_key: params.idempotencyKey },
        },
        { idempotencyKey: `rev_${params.idempotencyKey}` }
      )
      return { ok: true, method: 'transfer_reversal', transfer_reversal_id: reversal.id }
    }
  } catch (err) {
    console.error('transfer reversal clawback failed', err)
  }

  try {
    const debit = await params.stripe.charges.create(
      {
        amount: amountCents,
        currency: 'cad',
        source: params.connectedAccountId,
        description: params.description,
        metadata: { idempotency_key: params.idempotencyKey },
      },
      { idempotencyKey: `debit_${params.idempotencyKey}` }
    )
    return { ok: true, method: 'account_debit', charge_id: debit.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Clawback failed'
    console.error('account debit clawback failed', err)
    return { ok: false, method: 'none', error: message }
  }
}

export async function applyShopOrderClawback(params: {
  admin: SupabaseClient
  stripe: Stripe
  orderId: string
  kind: ClawbackKind
}): Promise<ClawbackResult> {
  const { data: order } = await params.admin
    .from('shop_orders')
    .select(
      'id, vendor_id, stripe_payment_intent_id, apv_adjustment_cad, apv_clawback_status, dispute_clawback_cad, dispute_clawback_status, clawback_failure_count'
    )
    .eq('id', params.orderId)
    .maybeSingle()

  if (!order) return { ok: false, method: 'none', error: 'Order not found' }

  const amountCad =
    params.kind === 'apv' ? Number(order.apv_adjustment_cad ?? 0) : Number(order.dispute_clawback_cad ?? 0)
  const statusField = params.kind === 'apv' ? 'apv_clawback_status' : 'dispute_clawback_status'
  const currentStatus = params.kind === 'apv' ? order.apv_clawback_status : order.dispute_clawback_status

  if (currentStatus === 'debited') {
    return { ok: true, method: 'none' }
  }
  if (!(amountCad > 0)) {
    return { ok: false, method: 'none', error: 'No clawback amount' }
  }

  const { data: vendor } = await params.admin
    .from('vendor_profiles')
    .select('id, stripe_account_id, shop_status')
    .eq('id', order.vendor_id)
    .maybeSingle()

  if (!vendor?.stripe_account_id) {
    return { ok: false, method: 'none', error: 'Vendor Stripe account missing' }
  }

  const result = await clawbackFromVendor({
    stripe: params.stripe,
    connectedAccountId: vendor.stripe_account_id,
    amountCad,
    paymentIntentId: order.stripe_payment_intent_id,
    idempotencyKey: `${params.kind}_${order.id}_${Math.round(amountCad * 100)}`,
    description: `Marketplace ${params.kind} clawback for order ${order.id}`,
  })

  if (result.ok) {
    await params.admin
      .from('shop_orders')
      .update({ [statusField]: 'debited' })
      .eq('id', order.id)
    return result
  }

  const failures = Number(order.clawback_failure_count ?? 0) + 1
  await params.admin
    .from('shop_orders')
    .update({
      [statusField]: 'failed',
      clawback_failure_count: failures,
    })
    .eq('id', order.id)

  if (failures >= 3) {
    await params.admin
      .from('vendor_profiles')
      .update({ shop_status: 'suspended' })
      .eq('id', vendor.id)
  }

  return result
}
