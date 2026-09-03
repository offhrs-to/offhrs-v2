import { createClient } from '@/lib/supabase/server'
import { purchaseLabelForShopOrder, type ShopOrderRow } from '@/lib/shop/fulfillment'
import { loadVendorShopOrder, resolveMarketplaceVendor } from '@/lib/shop/partner-context'
import { NextRequest, NextResponse } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

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

    const result = await purchaseLabelForShopOrder(admin, order as ShopOrderRow)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('shop-orders label POST', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not purchase label' },
      { status: 422 }
    )
  }
}
