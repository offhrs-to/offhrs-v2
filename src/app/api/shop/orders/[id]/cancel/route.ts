import { resolveApiUser } from '@/lib/api-auth-user'
import { sendShopBuyerRefunded } from '@/lib/emails'
import {
  canCancelShopOrder,
  refundShopOrderPreScan,
  type ShopOrderRow,
} from '@/lib/shop/fulfillment'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

type Ctx = { params: Promise<{ id: string }> }

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder', {
  apiVersion: '2026-04-22.dahlia',
})

/**
 * POST /api/shop/orders/[id]/cancel
 * Buyer self-cancel before carrier First Scan (or before pickup completion).
 * Full refund to original payment method; voids prepaid label when possible.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const user = await resolveApiUser(request)
    if (!user?.id) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { data: order, error: oErr } = await admin
      .from('shop_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (oErr) {
      console.error('shop order cancel load', oErr)
      return NextResponse.json({ error: oErr.message }, { status: 500 })
    }
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!canCancelShopOrder(order)) {
      return NextResponse.json(
        {
          error:
            order.fulfillment_type === 'pickup'
              ? 'This order can no longer be cancelled (pickup already completed).'
              : 'This order can no longer be cancelled after the carrier First Scan.',
        },
        { status: 422 }
      )
    }

    const alreadyRefunded = order.status === 'refunded' || order.status === 'cancelled'
    const result = await refundShopOrderPreScan({
      admin,
      stripe,
      order: order as ShopOrderRow,
      initiatedBy: 'buyer',
    })

    if (!alreadyRefunded && order.buyer_email) {
      try {
        await sendShopBuyerRefunded({
          to: order.buyer_email,
          buyerName: order.buyer_name,
          productTitle: order.product_title,
          totalCad: Number(order.total_cad),
          cancelledByBuyer: true,
        })
      } catch (emailErr) {
        console.error('shop buyer cancel email', emailErr)
      }
    }

    return NextResponse.json({ success: true, refund_id: result.refund_id })
  } catch (err) {
    console.error('shop order cancel POST', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not cancel order' },
      { status: 422 }
    )
  }
}
