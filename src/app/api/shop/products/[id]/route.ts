import { resolveApiUser } from '@/lib/api-auth-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

const PRODUCT_SELECT =
  'id, title, description, price_cad, category, quantity, status, weight_g, length_cm, width_cm, height_cm, fragile, pickup_available, made_to_order, ship_by_business_days, buyer_remorse_returns, image_urls, created_at, vendor_id'

const VENDOR_SELECT =
  'id, business_name, slug, bio, shop_pickup_enabled, shop_pickup_line1, shop_pickup_line2, shop_pickup_city, shop_pickup_province, shop_pickup_postal_code, shop_pickup_hours, marketplace_enabled, shop_status, marketplace_qa_status, status'

function vendorIsLive(vendor: {
  marketplace_enabled?: boolean | null
  shop_status?: string | null
  marketplace_qa_status?: string | null
  status?: string | null
} | null): boolean {
  return Boolean(
    vendor?.marketplace_enabled &&
      vendor.shop_status === 'live' &&
      vendor.marketplace_qa_status === 'approved' &&
      ['trialing', 'active', 'past_due'].includes(vendor.status ?? '')
  )
}

function formatProductResponse(
  product: Record<string, unknown>,
  vendor: Record<string, unknown> | null,
  purchasable: boolean
) {
  const shopPickupEnabled = Boolean(vendor?.shop_pickup_enabled)
  return {
    product: {
      ...product,
      price_cad: Number(product.price_cad),
      pickup_available: Boolean(product.pickup_available) && shopPickupEnabled,
      purchasable,
    },
    vendor: vendor
      ? {
          id: vendor.id,
          business_name: vendor.business_name,
          slug: vendor.slug,
          bio: vendor.bio,
          shop_pickup_enabled: shopPickupEnabled,
          shop_pickup_line1: vendor.shop_pickup_line1 ?? null,
          shop_pickup_line2: vendor.shop_pickup_line2 ?? null,
          shop_pickup_city: vendor.shop_pickup_city ?? null,
          shop_pickup_province: vendor.shop_pickup_province ?? null,
          shop_pickup_postal_code: vendor.shop_pickup_postal_code ?? null,
          shop_pickup_hours: vendor.shop_pickup_hours ?? null,
        }
      : null,
  }
}

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { data: product, error } = await admin
      .from('shop_products')
      .select(PRODUCT_SELECT)
      .eq('id', id)
      .eq('status', 'published')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (product) {
      const { data: vendor } = await admin
        .from('vendor_profiles')
        .select(VENDOR_SELECT)
        .eq('id', product.vendor_id)
        .maybeSingle()

      if (!vendorIsLive(vendor)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const purchasable = Number(product.quantity) > 0
      return NextResponse.json(formatProductResponse(product, vendor, purchasable))
    }

    const user = await resolveApiUser(request)
    if (!user?.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: priorOrder } = await admin
      .from('shop_orders')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', id)
      .limit(1)
      .maybeSingle()

    if (!priorOrder) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: archivedProduct, error: archivedErr } = await admin
      .from('shop_products')
      .select(PRODUCT_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (archivedErr) return NextResponse.json({ error: archivedErr.message }, { status: 500 })
    if (!archivedProduct) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select(VENDOR_SELECT)
      .eq('id', archivedProduct.vendor_id)
      .maybeSingle()

    return NextResponse.json(formatProductResponse(archivedProduct, vendor, false))
  } catch (err) {
    console.error('shop products [id] GET', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
