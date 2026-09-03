import { createClient } from '@/lib/supabase/server'
import { sendShopBuyerRefunded } from '@/lib/emails'
import { refundShopOrderPreScan, type ShopOrderRow } from '@/lib/shop/fulfillment'
import { loadVendorShopOrder, resolveMarketplaceVendor } from '@/lib/shop/partner-context'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

type Ctx = { params: Promise<{ id: string }> }

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { admin, vendor, error } = await resolveMarketplaceVendor(user.id)
    if (error || !admin || !vendor) {
      return NextResponse.json({ error: error ?? 'Forbidden' }, { status: error === 'Server error' ? 500 : 403 })
    }

    const { data: order, error: oErr } = await loadVendorShopOrder(admin, vendor.id, id)
    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const alreadyRefunded = order.status === 'refunded' || order.status === 'cancelled'
    const result = await refundShopOrderPreScan({ admin, stripe, order: order as ShopOrderRow })

    if (!alreadyRefunded && order.buyer_email) {
      try {
        await sendShopBuyerRefunded({
          to: order.buyer_email,
          buyerName: order.buyer_name,
          productTitle: order.product_title,
          totalCad: Number(order.total_cad),
        })
      } catch (emailErr) {
        console.error('shop refund email', emailErr)
      }
    }

    return NextResponse.json({ success: true, refund_id: result.refund_id })
  } catch (err) {
    console.error('shop-orders refund POST', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not refund order' },
      { status: 422 }
    )
  }
}
