import { verifyAdmin } from '@/lib/admin-auth'
import { applyShopOrderClawback } from '@/lib/shop/clawback'
import { purchaseLabelForShopOrder, refundShopOrderPreScan, type ShopOrderRow } from '@/lib/shop/fulfillment'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const status = request.nextUrl.searchParams.get('status')
  const filter = request.nextUrl.searchParams.get('filter')

  let query = admin
    .from('shop_orders')
    .select(
      'id, product_title, status, fulfillment_type, total_cad, shipping_collected_cad, shippo_rate_amount_cad, shippo_label_cost_cad, tax_cad, paid_at, tracking_number, tracking_url, shippo_label_url, first_scan_at, vendor_id, buyer_email, apv_clawback_status, apv_adjustment_cad, stripe_dispute_id, stripe_dispute_status, dispute_reason, dispute_amount_cad, dispute_clawback_status, dispute_clawback_cad, vendor_profiles(business_name)'
    )
    .order('paid_at', { ascending: false, nullsFirst: false })
    .limit(100)

  if (status) query = query.eq('status', status)
  if (filter === 'apv_pending') query = query.in('apv_clawback_status', ['pending', 'failed'])
  if (filter === 'dispute_pending') query = query.in('dispute_clawback_status', ['pending', 'failed'])
  if (filter === 'disputed') query = query.eq('status', 'disputed')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type AdminClaimRow = {
    id: string
    order_id: string
    reason: string
    status: string
    description: string
    seller_response: string | null
    created_at: string
  }

  const orderIds = (data ?? []).map((o) => o.id)
  const { data: claims } = orderIds.length
    ? await admin
        .from('shop_order_claims')
        .select('id, order_id, reason, status, description, seller_response, created_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false })
    : { data: [] as AdminClaimRow[] }

  const claimsByOrder = new Map<string, AdminClaimRow[]>()
  for (const c of (claims ?? []) as AdminClaimRow[]) {
    const list = claimsByOrder.get(c.order_id) ?? []
    list.push(c)
    claimsByOrder.set(c.order_id, list)
  }

  const orders = (data ?? []).map((o) => ({
    ...o,
    claims: claimsByOrder.get(o.id) ?? [],
  }))

  return NextResponse.json({ orders })
}

const patchSchema = z.object({
  order_id: z.string().uuid(),
  action: z.enum(['retry_label', 'refund', 'clawback_apv', 'clawback_dispute', 'resolve_claim', 'reject_claim']),
  claim_id: z.string().uuid().optional(),
  admin_notes: z.string().max(4000).optional(),
})

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const parsed = patchSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })

  const { data: order, error } = await admin
    .from('shop_orders')
    .select('*')
    .eq('id', parsed.data.order_id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  try {
    if (parsed.data.action === 'retry_label') {
      const result = await purchaseLabelForShopOrder(admin, order as ShopOrderRow)
      return NextResponse.json({ success: true, ...result })
    }
    if (parsed.data.action === 'refund') {
      const result = await refundShopOrderPreScan({ admin, stripe, order: order as ShopOrderRow })
      return NextResponse.json({ success: true, ...result })
    }
    if (parsed.data.action === 'clawback_apv') {
      const result = await applyShopOrderClawback({ admin, stripe, orderId: order.id, kind: 'apv' })
      return NextResponse.json({ success: result.ok, ...result })
    }
    if (parsed.data.action === 'clawback_dispute') {
      const result = await applyShopOrderClawback({ admin, stripe, orderId: order.id, kind: 'dispute' })
      return NextResponse.json({ success: result.ok, ...result })
    }
    if (parsed.data.action === 'resolve_claim' || parsed.data.action === 'reject_claim') {
      if (!parsed.data.claim_id) {
        return NextResponse.json({ error: 'claim_id required' }, { status: 400 })
      }
      const { error: cErr } = await admin
        .from('shop_order_claims')
        .update({
          status: parsed.data.action === 'resolve_claim' ? 'resolved' : 'rejected',
          admin_notes: parsed.data.admin_notes?.trim() || null,
        })
        .eq('id', parsed.data.claim_id)
        .eq('order_id', order.id)
      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Action failed' },
      { status: 422 }
    )
  }
}
