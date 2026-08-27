import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import {
  ensureMarketplaceIncludedFlags,
  vendorHasMarketplaceAccess,
} from '@/lib/shop/access'
import { shopProductWriteSchema } from '@/lib/shop/product-schema'
import { canPublishShopProducts, marketplacePublishBlockers } from '@/lib/shop/publish-gates'

async function resolveMarketplaceVendor(userId: string) {
  const admin = createAdminClient()
  if (!admin) return { admin: null, vendor: null, error: 'Server error' as const }

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select(
      'id, marketplace_enabled, ship_from_name, ship_from_line1, ship_from_city, ship_from_province, ship_from_postal_code, ship_from_country, canada_ship_attested_at, marketplace_qa_status, shop_pickup_enabled'
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (!vendor) return { admin, vendor: null, error: 'Vendor not found' as const }

  await ensureMarketplaceIncludedFlags(admin, vendor.id)

  const hasAccess = await vendorHasMarketplaceAccess(admin, vendor.id)
  if (!hasAccess) return { admin, vendor: null, error: 'Marketplace access required' as const }

  const { data: refreshed } = await admin
    .from('vendor_profiles')
    .select(
      'id, marketplace_enabled, ship_from_name, ship_from_line1, ship_from_city, ship_from_province, ship_from_postal_code, ship_from_country, canada_ship_attested_at, marketplace_qa_status, shop_pickup_enabled'
    )
    .eq('id', vendor.id)
    .single()

  return { admin, vendor: refreshed ?? vendor, error: null }
}

// GET /api/partners/shop-products
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { admin, vendor, error } = await resolveMarketplaceVendor(user.id)
    if (error === 'Server error') return NextResponse.json({ error }, { status: 500 })
    if (error === 'Vendor not found') return NextResponse.json({ error }, { status: 404 })
    if (error || !admin || !vendor) {
      return NextResponse.json({ error: error ?? 'Forbidden' }, { status: 403 })
    }

    const status = request.nextUrl.searchParams.get('status')
    let query = admin.from('shop_products').select('*').eq('vendor_id', vendor.id)

    if (status && ['draft', 'published', 'archived'].includes(status)) {
      query = query.eq('status', status)
    } else {
      query = query.neq('status', 'archived')
    }

    const { data: products, error: qErr } = await query.order('created_at', { ascending: false })
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

    return NextResponse.json({
      products: products ?? [],
      publish_blockers: marketplacePublishBlockers(vendor),
      can_publish: canPublishShopProducts(vendor),
    })
  } catch (err) {
    console.error('shop-products GET', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/partners/shop-products
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { admin, vendor, error } = await resolveMarketplaceVendor(user.id)
    if (error === 'Server error') return NextResponse.json({ error }, { status: 500 })
    if (error === 'Vendor not found') return NextResponse.json({ error }, { status: 404 })
    if (error || !admin || !vendor) {
      return NextResponse.json({ error: error ?? 'Forbidden' }, { status: 403 })
    }

    const parsed = shopProductWriteSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    if (data.status === 'published') {
      const blockers = marketplacePublishBlockers(vendor)
      if (blockers.length) {
        return NextResponse.json({ error: blockers[0], blockers }, { status: 400 })
      }
      if (data.pickup_available && !vendor.shop_pickup_enabled) {
        return NextResponse.json(
          { error: 'Enable pickup in shipping settings before offering pickup on a listing.' },
          { status: 400 }
        )
      }
    }

    const { data: product, error: insertErr } = await admin
      .from('shop_products')
      .insert({
        vendor_id: vendor.id,
        title: data.title,
        description: data.description ?? null,
        category: data.category,
        price_cad: data.price_cad,
        quantity: data.quantity,
        weight_g: data.weight_g,
        length_cm: data.length_cm,
        width_cm: data.width_cm,
        height_cm: data.height_cm,
        fragile: data.fragile,
        pickup_available: data.pickup_available,
        made_to_order: data.made_to_order,
        ship_by_business_days: data.ship_by_business_days,
        buyer_remorse_returns: data.buyer_remorse_returns,
        status: data.status,
        image_urls: data.image_urls,
      })
      .select('*')
      .single()

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    return NextResponse.json({ product }, { status: 201 })
  } catch (err) {
    console.error('shop-products POST', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
