import { verifyAdmin } from '@/lib/admin-auth'
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
  let query = admin
    .from('shop_orders')
    .select(
      'id, product_title, status, fulfillment_type, total_cad, paid_at, tracking_number, tracking_url, shippo_label_url, first_scan_at, vendor_id, buyer_email, apv_clawback_status, apv_adjustment_cad, vendor_profiles(business_name)'
    )
    .order('paid_at', { ascending: false, nullsFirst: false })
    .limit(100)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data ?? [] })
}

const patchSchema = z.object({
  order_id: z.string().uuid(),
  action: z.enum(['retry_label', 'refund']),
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
    const result = await refundShopOrderPreScan({ admin, stripe, order: order as ShopOrderRow })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Action failed' },
      { status: 422 }
    )
  }
}
