import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  sendShopDisputeOpened,
  sendShopDisputeLost,
  sendShopDisputeWon,
} from '@/lib/emails'
import { SHOP_DISPUTE_FEE_CAD, applyShopOrderClawback } from '@/lib/shop/clawback'
import type Stripe from 'stripe'

function disputeAmountCad(dispute: Stripe.Dispute): number {
  return Math.round(dispute.amount) / 100
}

function paymentIntentIdFromDispute(dispute: Stripe.Dispute): string | null {
  const pi = dispute.payment_intent
  if (typeof pi === 'string') return pi
  if (pi && typeof pi === 'object' && 'id' in pi) return pi.id
  const charge = dispute.charge
  if (typeof charge === 'object' && charge && 'payment_intent' in charge) {
    const nested = charge.payment_intent
    if (typeof nested === 'string') return nested
    if (nested && typeof nested === 'object' && 'id' in nested) return String(nested.id)
  }
  return null
}

async function loadShopOrderByPaymentIntent(admin: SupabaseClient, piId: string) {
  const { data } = await admin
    .from('shop_orders')
    .select(
      'id, vendor_id, product_title, buyer_email, buyer_name, total_cad, status, stripe_payment_intent_id, dispute_clawback_status'
    )
    .eq('stripe_payment_intent_id', piId)
    .maybeSingle()
  return data
}

async function notifySellerDispute(
  admin: SupabaseClient,
  vendorId: string,
  send: (email: string) => Promise<void>
) {
  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('user_id, business_name')
    .eq('id', vendorId)
    .maybeSingle()
  if (!vendor?.user_id) return
  const { data: authUser } = await admin.auth.admin.getUserById(vendor.user_id)
  const email = authUser?.user?.email
  if (email) await send(email)
}

export async function handleShopChargeDispute(params: {
  admin: SupabaseClient
  stripe: Stripe
  eventType: string
  dispute: Stripe.Dispute
}): Promise<{ handled: boolean }> {
  const { admin, stripe, eventType, dispute } = params
  const piId = paymentIntentIdFromDispute(dispute)
  if (!piId) return { handled: false }

  const order = await loadShopOrderByPaymentIntent(admin, piId)
  if (!order) return { handled: false }

  const amountCad = disputeAmountCad(dispute)
  const reason = dispute.reason ?? null

  if (eventType === 'charge.dispute.created' || eventType === 'charge.dispute.updated') {
    await admin
      .from('shop_orders')
      .update({
        status: 'disputed',
        stripe_dispute_id: dispute.id,
        stripe_dispute_status: dispute.status,
        dispute_reason: reason,
        dispute_amount_cad: amountCad,
      })
      .eq('id', order.id)

    if (eventType === 'charge.dispute.created') {
      try {
        await notifySellerDispute(admin, order.vendor_id, (to) =>
          sendShopDisputeOpened({
            to,
            productTitle: order.product_title,
            disputeId: dispute.id,
            amountCad,
            reason,
          })
        )
        const ops = process.env.OPS_ALERT_EMAIL?.trim() || process.env.RESEND_FROM_EMAIL
        if (ops) {
          await sendShopDisputeOpened({
            to: ops,
            productTitle: order.product_title,
            disputeId: dispute.id,
            amountCad,
            reason,
          })
        }
      } catch (emailErr) {
        console.error('shop dispute opened email', emailErr)
      }
    }
    return { handled: true }
  }

  if (eventType === 'charge.dispute.closed') {
    const status = dispute.status
    await admin
      .from('shop_orders')
      .update({
        stripe_dispute_status: status,
        dispute_reason: reason,
        dispute_amount_cad: amountCad,
      })
      .eq('id', order.id)

    if (status === 'lost') {
      const clawbackCad = Math.round((amountCad + SHOP_DISPUTE_FEE_CAD) * 100) / 100
      await admin
        .from('shop_orders')
        .update({
          dispute_clawback_cad: clawbackCad,
          dispute_clawback_status: 'pending',
        })
        .eq('id', order.id)

      const result = await applyShopOrderClawback({
        admin,
        stripe,
        orderId: order.id,
        kind: 'dispute',
      })

      try {
        await notifySellerDispute(admin, order.vendor_id, (to) =>
          sendShopDisputeLost({
            to,
            productTitle: order.product_title,
            amountCad: clawbackCad,
            clawbackOk: result.ok,
          })
        )
      } catch (emailErr) {
        console.error('shop dispute lost email', emailErr)
      }
    } else if (status === 'won') {
      await admin
        .from('shop_orders')
        .update({
          dispute_clawback_status: 'none',
          dispute_clawback_cad: 0,
        })
        .eq('id', order.id)
      try {
        await notifySellerDispute(admin, order.vendor_id, (to) =>
          sendShopDisputeWon({
            to,
            productTitle: order.product_title,
          })
        )
      } catch (emailErr) {
        console.error('shop dispute won email', emailErr)
      }
    }

    return { handled: true }
  }

  return { handled: false }
}
