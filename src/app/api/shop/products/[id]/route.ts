import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { data: product, error } = await admin
      .from('shop_products')
      .select(
        'id, title, description, price_cad, category, quantity, weight_g, length_cm, width_cm, height_cm, fragile, pickup_available, made_to_order, ship_by_business_days, buyer_remorse_returns, image_urls, created_at, vendor_id'
      )
      .eq('id', id)
      .eq('status', 'published')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select(
        'id, business_name, slug, bio, shop_pickup_enabled, marketplace_enabled, shop_status, marketplace_qa_status, status'
      )
      .eq('id', product.vendor_id)
      .maybeSingle()

    if (
      !vendor?.marketplace_enabled ||
      vendor.shop_status !== 'live' ||
      vendor.marketplace_qa_status !== 'approved' ||
      !['trialing', 'active', 'past_due'].includes(vendor.status ?? '')
    ) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      product: {
        ...product,
        price_cad: Number(product.price_cad),
        pickup_available: product.pickup_available && vendor.shop_pickup_enabled,
      },
      vendor: {
        id: vendor.id,
        business_name: vendor.business_name,
        slug: vendor.slug,
        bio: vendor.bio,
        shop_pickup_enabled: vendor.shop_pickup_enabled,
      },
    })
  } catch (err) {
    console.error('shop products [id] GET', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
