import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import {
  ensureMarketplaceIncludedFlags,
  vendorHasMarketplaceAccess,
} from '@/lib/shop/access'
import { shopProductWriteSchema } from '@/lib/shop/product-schema'
import { marketplacePublishBlockers } from '@/lib/shop/publish-gates'

async function resolveVendor(userId: string) {
  const admin = createAdminClient()
  if (!admin) return { admin: null, vendor: null, error: 'Server error' as const }

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select(
      'id, ship_from_name, ship_from_line1, ship_from_city, ship_from_province, ship_from_postal_code, ship_from_country, canada_ship_attested_at, marketplace_qa_status, shop_pickup_enabled'
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (!vendor) return { admin, vendor: null, error: 'Vendor not found' as const }
  await ensureMarketplaceIncludedFlags(admin, vendor.id)
  if (!(await vendorHasMarketplaceAccess(admin, vendor.id))) {
    return { admin, vendor: null, error: 'Marketplace access required' as const }
  }

  const { data: refreshed } = await admin
    .from('vendor_profiles')
    .select(
      'id, ship_from_name, ship_from_line1, ship_from_city, ship_from_province, ship_from_postal_code, ship_from_country, canada_ship_attested_at, marketplace_qa_status, shop_pickup_enabled'
    )
    .eq('id', vendor.id)
    .single()

  return { admin, vendor: refreshed ?? vendor, error: null }
}

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { admin, vendor, error } = await resolveVendor(user.id)
    if (error === 'Server error') return NextResponse.json({ error }, { status: 500 })
    if (error === 'Vendor not found') return NextResponse.json({ error }, { status: 404 })
    if (error || !admin || !vendor) {
      return NextResponse.json({ error: error ?? 'Forbidden' }, { status: 403 })
    }

    const { data: product, error: qErr } = await admin
      .from('shop_products')
      .select('*')
      .eq('id', id)
      .eq('vendor_id', vendor.id)
      .maybeSingle()

    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ product })
  } catch (err) {
    console.error('shop-products [id] GET', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { admin, vendor, error } = await resolveVendor(user.id)
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

    const { data: product, error: upErr } = await admin
      .from('shop_products')
      .update({
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
      .eq('id', id)
      .eq('vendor_id', vendor.id)
      .select('*')
      .maybeSingle()

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ product })
  } catch (err) {
    console.error('shop-products [id] PATCH', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { admin, vendor, error } = await resolveVendor(user.id)
    if (error === 'Server error') return NextResponse.json({ error }, { status: 500 })
    if (error === 'Vendor not found') return NextResponse.json({ error }, { status: 404 })
    if (error || !admin || !vendor) {
      return NextResponse.json({ error: error ?? 'Forbidden' }, { status: 403 })
    }

    const { data: product, error: upErr } = await admin
      .from('shop_products')
      .update({ status: 'archived' })
      .eq('id', id)
      .eq('vendor_id', vendor.id)
      .select('id')
      .maybeSingle()

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('shop-products [id] DELETE', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
