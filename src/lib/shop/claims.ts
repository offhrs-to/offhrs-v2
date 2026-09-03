import 'server-only'

import { SHOP_SNAD_RETURN_DAYS } from '@/lib/shop/fees'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ShopClaimReason = 'damaged' | 'snad' | 'other'

export function shopOrderClaimWindowOpen(order: {
  delivered_at: string | null
  picked_up_at: string | null
  status: string
}): { ok: boolean; error?: string } {
  if (!['completed', 'shipped', 'disputed'].includes(order.status) && !order.delivered_at && !order.picked_up_at) {
    return { ok: false, error: 'Claims are only available after delivery or pickup' }
  }
  const anchor = order.delivered_at || order.picked_up_at
  if (!anchor) {
    return { ok: false, error: 'Order is not marked delivered or picked up yet' }
  }
  const end = new Date(anchor).getTime() + SHOP_SNAD_RETURN_DAYS * 24 * 60 * 60 * 1000
  if (Date.now() > end) {
    return { ok: false, error: `Claim window is ${SHOP_SNAD_RETURN_DAYS} days from delivery/pickup` }
  }
  return { ok: true }
}

export async function createShopOrderClaim(params: {
  admin: SupabaseClient
  orderId: string
  buyerUserId: string
  reason: ShopClaimReason
  description: string
  photoUrls?: string[]
}): Promise<{ id: string } | { error: string; status: number }> {
  const { data: order } = await params.admin
    .from('shop_orders')
    .select('id, user_id, status, delivered_at, picked_up_at, product_id')
    .eq('id', params.orderId)
    .maybeSingle()

  if (!order) return { error: 'Order not found', status: 404 }
  if (order.user_id !== params.buyerUserId) return { error: 'Forbidden', status: 403 }

  const window = shopOrderClaimWindowOpen(order)
  if (!window.ok) return { error: window.error ?? 'Claim not allowed', status: 422 }

  if (params.reason === 'other') {
    const { data: product } = await params.admin
      .from('shop_products')
      .select('buyer_remorse_returns')
      .eq('id', order.product_id)
      .maybeSingle()
    if (product && product.buyer_remorse_returns === false) {
      return {
        error: 'This listing does not accept remorse returns. Use damaged or SNAD for quality issues.',
        status: 422,
      }
    }
  }

  const description = params.description.trim()
  if (description.length < 10) return { error: 'Please describe the issue (at least 10 characters)', status: 400 }

  const photoUrls = (params.photoUrls ?? []).filter((u) => typeof u === 'string' && u.startsWith('http')).slice(0, 6)

  const { data: claim, error } = await params.admin
    .from('shop_order_claims')
    .insert({
      order_id: order.id,
      buyer_user_id: params.buyerUserId,
      reason: params.reason,
      description,
      photo_urls: photoUrls,
      status: 'open',
    })
    .select('id')
    .single()

  if (error) return { error: error.message, status: 500 }
  return { id: claim.id }
}
