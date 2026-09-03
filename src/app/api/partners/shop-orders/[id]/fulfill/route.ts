import { createClient } from '@/lib/supabase/server'
import { markShopOrderDroppedOff, markShopOrderPickedUp, type ShopOrderRow } from '@/lib/shop/fulfillment'
import { loadVendorShopOrder, resolveMarketplaceVendor } from '@/lib/shop/partner-context'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  action: z.enum(['picked_up', 'dropped_off']),
})

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { admin, vendor, error } = await resolveMarketplaceVendor(user.id)
    if (error || !admin || !vendor) {
      return NextResponse.json({ error: error ?? 'Forbidden' }, { status: error === 'Server error' ? 500 : 403 })
    }

    const { data: order, error: oErr } = await loadVendorShopOrder(admin, vendor.id, id)
    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    if (parsed.data.action === 'picked_up') {
      await markShopOrderPickedUp(admin, order as ShopOrderRow)
    } else {
      await markShopOrderDroppedOff(admin, order as ShopOrderRow)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('shop-orders fulfill POST', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not update order' },
      { status: 422 }
    )
  }
}
