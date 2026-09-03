import { createClient } from '@/lib/supabase/server'
import { loadVendorShopOrder, resolveMarketplaceVendor } from '@/lib/shop/partner-context'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  seller_response: z.string().min(2).max(4000),
})

/** Seller responds to an open claim on their order. */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id: orderId } = await ctx.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid response' }, { status: 400 })

    const { admin, vendor, error } = await resolveMarketplaceVendor(user.id)
    if (error || !admin || !vendor) {
      return NextResponse.json({ error: error ?? 'Forbidden' }, { status: error === 'Server error' ? 500 : 403 })
    }

    const { data: order } = await loadVendorShopOrder(admin, vendor.id, orderId)
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const claimId = request.nextUrl.searchParams.get('claim_id')
    let query = admin
      .from('shop_order_claims')
      .update({
        seller_response: parsed.data.seller_response.trim(),
        status: 'seller_responded',
      })
      .eq('order_id', orderId)
      .in('status', ['open', 'seller_responded'])

    if (claimId) query = query.eq('id', claimId)

    const { data, error: uErr } = await query.select('id').maybeSingle()
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'No open claim found' }, { status: 404 })

    return NextResponse.json({ success: true, claim_id: data.id })
  } catch (err) {
    console.error('shop-orders claim respond', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** List claims for this vendor order (partner). */
export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id: orderId } = await ctx.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { admin, vendor, error } = await resolveMarketplaceVendor(user.id)
    if (error || !admin || !vendor) {
      return NextResponse.json({ error: error ?? 'Forbidden' }, { status: error === 'Server error' ? 500 : 403 })
    }

    const { data: order } = await loadVendorShopOrder(admin, vendor.id, orderId)
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const { data, error: qErr } = await admin
      .from('shop_order_claims')
      .select('id, reason, description, photo_urls, status, seller_response, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })

    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
    return NextResponse.json({ claims: data ?? [] })
  } catch (err) {
    console.error('shop-orders claims GET', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
