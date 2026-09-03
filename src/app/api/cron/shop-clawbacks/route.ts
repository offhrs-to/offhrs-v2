import { applyShopOrderClawback } from '@/lib/shop/clawback'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

/** Daily: retry pending/failed Marketplace clawbacks (APV + disputes). */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })

    const { data: apvOrders } = await admin
      .from('shop_orders')
      .select('id')
      .in('apv_clawback_status', ['pending', 'failed'])
      .gt('apv_adjustment_cad', 0)
      .limit(40)

    const { data: disputeOrders } = await admin
      .from('shop_orders')
      .select('id')
      .in('dispute_clawback_status', ['pending', 'failed'])
      .gt('dispute_clawback_cad', 0)
      .limit(40)

    let ok = 0
    let failed = 0

    for (const row of apvOrders ?? []) {
      const result = await applyShopOrderClawback({ admin, stripe, orderId: row.id, kind: 'apv' })
      if (result.ok) ok += 1
      else failed += 1
    }
    for (const row of disputeOrders ?? []) {
      const result = await applyShopOrderClawback({ admin, stripe, orderId: row.id, kind: 'dispute' })
      if (result.ok) ok += 1
      else failed += 1
    }

    return NextResponse.json({
      ok,
      failed,
      scanned: (apvOrders?.length ?? 0) + (disputeOrders?.length ?? 0),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Cron shop-clawbacks', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
