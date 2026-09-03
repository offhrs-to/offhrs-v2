import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { addCanadianBusinessDays } from '@/lib/shop/business-days'
import {
  fetchShippoRates,
  getShippoTransaction,
  purchaseShippoLabel,
  voidShippoLabel,
  type ShippoAddressInput,
} from '@/lib/shop/shippo'

export type ShopOrderRow = {
  id: string
  vendor_id: string
  product_id: string
  status: string
  fulfillment_type: string
  quantity: number
  stripe_payment_intent_id: string
  stripe_refund_id: string | null
  stripe_tax_transaction_id: string | null
  shippo_rate_id: string | null
  shippo_shipment_id: string | null
  shippo_transaction_id: string | null
  shippo_label_url: string | null
  tracking_number: string | null
  tracking_url: string | null
  first_scan_at: string | null
  ship_to_name: string | null
  ship_to_line1: string | null
  ship_to_line2: string | null
  ship_to_city: string | null
  ship_to_province: string | null
  ship_to_postal_code: string | null
  ship_to_country: string | null
  item_subtotal_cad: number
  paid_at: string | null
  ship_by_business_days: number
}

const ACTIVE_FOR_LABEL = ['paid_awaiting_fulfillment', 'label_purchased']

export function shopOrderShipByAt(paidAt: string | null, shipByBusinessDays: number): string | null {
  if (!paidAt) return null
  return addCanadianBusinessDays(new Date(paidAt), shipByBusinessDays).toISOString()
}

export function canCancelShopOrder(order: { first_scan_at: string | null; status: string }): boolean {
  if (['cancelled', 'refunded', 'disputed', 'completed'].includes(order.status)) return false
  return order.first_scan_at == null
}

export async function purchaseLabelForShopOrder(
  admin: SupabaseClient,
  order: ShopOrderRow
): Promise<{ label_url: string | null; tracking_number: string | null; tracking_url: string | null }> {
  if (order.fulfillment_type !== 'ship') {
    throw new Error('Pickup orders do not need a shipping label')
  }
  if (!canCancelShopOrder(order) && order.status !== 'label_purchased') {
    throw new Error('This order can no longer be labeled')
  }
  if (order.shippo_label_url) {
    return {
      label_url: order.shippo_label_url,
      tracking_number: order.tracking_number,
      tracking_url: order.tracking_url,
    }
  }

  if (order.shippo_transaction_id) {
    try {
      const existing = await getShippoTransaction(order.shippo_transaction_id)
      const status = existing.status.toUpperCase()

      if (status === 'SUCCESS' && existing.label_url) {
        const patch: Record<string, unknown> = {
          status: order.status === 'paid_awaiting_fulfillment' ? 'label_purchased' : order.status,
          shippo_label_url: existing.label_url,
          shippo_label_cost_cad: existing.label_cost_cad,
          tracking_number: existing.tracking_number ?? order.tracking_number,
          tracking_url: existing.tracking_url ?? order.tracking_url,
        }
        if (order.status === 'paid_awaiting_fulfillment') {
          patch.label_purchased_at = new Date().toISOString()
        }
        await admin.from('shop_orders').update(patch).eq('id', order.id)
        return {
          label_url: existing.label_url,
          tracking_number: existing.tracking_number ?? order.tracking_number,
          tracking_url: existing.tracking_url ?? order.tracking_url,
        }
      }

      if (status === 'QUEUED' || status === 'WAITING') {
        throw new Error('Label is still processing. Try again in a moment.')
      }

      if (status === 'SUCCESS' && !existing.label_url) {
        // Tracking exists but Shippo has not attached a PDF yet — keep order labeled, surface a clear error.
        await admin
          .from('shop_orders')
          .update({
            tracking_number: existing.tracking_number ?? order.tracking_number,
            tracking_url: existing.tracking_url ?? order.tracking_url,
            status: order.status === 'paid_awaiting_fulfillment' ? 'label_purchased' : order.status,
          })
          .eq('id', order.id)
        throw new Error(
          'Tracking is ready but the PDF label is not available yet. Wait a few seconds and click Print label again, or open the label from your Shippo dashboard.'
        )
      }

      if (status !== 'ERROR') {
        throw new Error('Label is still processing. Try again in a moment.')
      }
      // ERROR: fall through and purchase a new label from rates
    } catch (err) {
      if (err instanceof Error && (
        err.message.startsWith('Label is still processing') ||
        err.message.startsWith('Tracking is ready')
      )) {
        throw err
      }
      console.error('getShippoTransaction', err)
      throw new Error('Could not load the existing shipping label. Try again.')
    }
  }
  if (!['paid_awaiting_fulfillment', 'label_purchased'].includes(order.status)) {
    throw new Error('Order is not awaiting a label')
  }

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select(
      'ship_from_name, ship_from_line1, ship_from_line2, ship_from_city, ship_from_province, ship_from_postal_code, ship_from_country, ship_from_phone'
    )
    .eq('id', order.vendor_id)
    .maybeSingle()

  const from: ShippoAddressInput | null =
    vendor?.ship_from_name &&
    vendor.ship_from_line1 &&
    vendor.ship_from_city &&
    vendor.ship_from_province &&
    vendor.ship_from_postal_code
      ? {
          name: vendor.ship_from_name,
          line1: vendor.ship_from_line1,
          line2: vendor.ship_from_line2,
          city: vendor.ship_from_city,
          province: vendor.ship_from_province,
          postal_code: vendor.ship_from_postal_code,
          country: vendor.ship_from_country ?? 'CA',
          phone: vendor.ship_from_phone,
        }
      : null

  if (!from) throw new Error('Seller shipping address is not configured')

  const to: ShippoAddressInput | null =
    order.ship_to_name && order.ship_to_line1 && order.ship_to_city && order.ship_to_province && order.ship_to_postal_code
      ? {
          name: order.ship_to_name,
          line1: order.ship_to_line1,
          line2: order.ship_to_line2,
          city: order.ship_to_city,
          province: order.ship_to_province,
          postal_code: order.ship_to_postal_code,
          country: order.ship_to_country ?? 'CA',
        }
      : null
  if (!to) throw new Error('Buyer shipping address is missing')

  const { data: product } = await admin
    .from('shop_products')
    .select('weight_g, length_cm, width_cm, height_cm')
    .eq('id', order.product_id)
    .maybeSingle()

  if (!product) throw new Error('Product not found')

  let purchased
  try {
    if (!order.shippo_rate_id) throw new Error('missing rate')
    purchased = await purchaseShippoLabel(order.shippo_rate_id)
  } catch (firstErr) {
    const { shipment_id, rates } = await fetchShippoRates({
      from,
      to,
      parcel: {
        weight_g: Number(product.weight_g),
        length_cm: Number(product.length_cm),
        width_cm: Number(product.width_cm),
        height_cm: Number(product.height_cm),
      },
      itemSubtotalCad: Number(order.item_subtotal_cad),
    })
    const rate = rates[0]
    if (!rate) {
      throw firstErr instanceof Error ? firstErr : new Error('Could not purchase label')
    }
    purchased = await purchaseShippoLabel(rate.rate_id)
    await admin
      .from('shop_orders')
      .update({
        shippo_shipment_id: shipment_id,
        shippo_rate_id: rate.rate_id,
        shippo_rate_amount_cad: rate.amount_cad,
        shippo_carrier: rate.carrier,
        shippo_service_level: rate.service_level,
      })
      .eq('id', order.id)
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('shop_orders')
    .update({
      status: 'label_purchased',
      shippo_transaction_id: purchased.transaction_id,
      shippo_label_url: purchased.label_url,
      shippo_label_cost_cad: purchased.label_cost_cad,
      tracking_number: purchased.tracking_number,
      tracking_url: purchased.tracking_url,
      label_purchased_at: now,
    })
    .eq('id', order.id)
    .in('status', ACTIVE_FOR_LABEL)

  if (error) throw new Error(error.message)

  return {
    label_url: purchased.label_url,
    tracking_number: purchased.tracking_number,
    tracking_url: purchased.tracking_url,
  }
}

export async function markShopOrderPickedUp(admin: SupabaseClient, order: ShopOrderRow): Promise<void> {
  if (order.fulfillment_type !== 'pickup') throw new Error('Not a pickup order')
  if (!['paid_awaiting_fulfillment'].includes(order.status)) {
    throw new Error('Order is not awaiting pickup')
  }
  const now = new Date().toISOString()
  const { error } = await admin
    .from('shop_orders')
    .update({
      status: 'completed',
      picked_up_at: now,
    })
    .eq('id', order.id)
    .eq('status', 'paid_awaiting_fulfillment')
  if (error) throw new Error(error.message)
}

export async function markShopOrderDroppedOff(admin: SupabaseClient, order: ShopOrderRow): Promise<void> {
  if (order.fulfillment_type !== 'ship') throw new Error('Not a shipped order')
  if (!['label_purchased', 'shipped'].includes(order.status)) {
    throw new Error('Print a label before confirming drop-off')
  }
  const { error } = await admin
    .from('shop_orders')
    .update({ dropoff_receipt_at: new Date().toISOString() })
    .eq('id', order.id)
  if (error) throw new Error(error.message)
}

export async function applyShopOrderTracking(params: {
  admin: SupabaseClient
  trackingNumber?: string | null
  transactionId?: string | null
  status?: string | null
}): Promise<{ applied: boolean; firstScanJustSet: boolean; orderId?: string }> {
  const { admin, trackingNumber, transactionId, status } = params
  if (!trackingNumber && !transactionId) return { applied: false, firstScanJustSet: false }

  let query = admin.from('shop_orders').select('id, status, first_scan_at, delivered_at, tracking_number')
  if (transactionId) query = query.eq('shippo_transaction_id', transactionId)
  else if (trackingNumber) query = query.eq('tracking_number', trackingNumber)

  const { data: order } = await query.maybeSingle()
  if (!order) return { applied: false, firstScanJustSet: false }

  const normalized = (status ?? '').toUpperCase()
  const patch: Record<string, unknown> = {}
  if (normalized) patch.tracking_status = normalized
  if (trackingNumber && !order.tracking_number) patch.tracking_number = trackingNumber

  const now = new Date().toISOString()
  let firstScanJustSet = false
  if (['TRANSIT', 'IN_TRANSIT'].includes(normalized) && !order.first_scan_at) {
    patch.first_scan_at = now
    firstScanJustSet = true
    if (order.status === 'label_purchased' || order.status === 'paid_awaiting_fulfillment') {
      patch.status = 'shipped'
    }
  }
  if (normalized === 'DELIVERED') {
    patch.delivered_at = order.delivered_at ?? now
    if (!order.first_scan_at) {
      patch.first_scan_at = now
      firstScanJustSet = true
    }
    patch.status = 'completed'
  }

  if (Object.keys(patch).length === 0) {
    return { applied: true, firstScanJustSet: false, orderId: order.id }
  }

  const { error } = await admin.from('shop_orders').update(patch).eq('id', order.id)
  if (error) {
    console.error('applyShopOrderTracking', error)
    return { applied: false, firstScanJustSet: false }
  }
  return { applied: true, firstScanJustSet, orderId: order.id }
}

export async function recordShopOrderApvAdjustment(
  admin: SupabaseClient,
  params: { transactionId?: string | null; trackingNumber?: string | null; adjustmentCad: number }
): Promise<void> {
  if (!params.transactionId && !params.trackingNumber) return
  let query = admin.from('shop_orders').select('id, apv_adjustment_cad')
  if (params.transactionId) query = query.eq('shippo_transaction_id', params.transactionId)
  else query = query.eq('tracking_number', params.trackingNumber!)

  const { data: order } = await query.maybeSingle()
  if (!order) return

  await admin
    .from('shop_orders')
    .update({
      apv_adjustment_cad: Number(order.apv_adjustment_cad ?? 0) + params.adjustmentCad,
      apv_clawback_status: 'pending',
    })
    .eq('id', order.id)
}

export async function refundShopOrderPreScan(params: {
  admin: SupabaseClient
  stripe: Stripe
  order: ShopOrderRow
}): Promise<{ refund_id: string | null }> {
  const { admin, stripe, order } = params
  if (!canCancelShopOrder(order)) {
    throw new Error('Cancel/refund is blocked after First Scan')
  }
  if (['cancelled', 'refunded'].includes(order.status)) {
    return { refund_id: order.stripe_refund_id }
  }

  if (order.shippo_transaction_id) {
    try {
      await voidShippoLabel(order.shippo_transaction_id)
    } catch (err) {
      console.error('voidShippoLabel', err)
      const raw = err instanceof Error ? err.message : 'Could not void shipping label'
      // Surface Canada Post's 60-minute void window with Toronto local time when present.
      throw new Error(
        raw.toLowerCase().includes('could not void')
          ? raw
          : `Could not void shipping label: ${raw}`
      )
    }
  }

  let refundId: string | null = null
  try {
    const refund = await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      reverse_transfer: true,
      refund_application_fee: true,
    })
    refundId = refund.id
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError && err.code === 'charge_already_refunded') {
      refundId = 'already_refunded'
    } else {
      throw err
    }
  }

  if (order.stripe_tax_transaction_id) {
    try {
      await stripe.tax.transactions.createReversal({
        mode: 'full',
        original_transaction: order.stripe_tax_transaction_id,
        reference: `shop_order_${order.id}_refund`,
      })
    } catch (taxErr) {
      console.error('shop tax reversal failed', taxErr)
    }
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('shop_orders')
    .update({
      status: 'refunded',
      refunded_at: now,
      cancelled_at: now,
      stripe_refund_id: refundId,
    })
    .eq('id', order.id)
  if (error) throw new Error(error.message)

  const { data: product } = await admin
    .from('shop_products')
    .select('quantity, status')
    .eq('id', order.product_id)
    .maybeSingle()

  if (product) {
    const newQty = Number(product.quantity) + Number(order.quantity)
    await admin
      .from('shop_products')
      .update({
        quantity: newQty,
        ...(product.status === 'archived' && Number(product.quantity) === 0 ? { status: 'published' } : {}),
      })
      .eq('id', order.product_id)
  }

  return { refund_id: refundId }
}