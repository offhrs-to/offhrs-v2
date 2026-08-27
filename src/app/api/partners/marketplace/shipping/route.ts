import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import {
  ensureMarketplaceIncludedFlags,
  vendorHasMarketplaceAccess,
} from '@/lib/shop/access'
import { shopShippingSettingsSchema } from '@/lib/shop/product-schema'
import { canPublishShopProducts, marketplacePublishBlockers } from '@/lib/shop/publish-gates'

const SHIP_SELECT =
  'ship_from_name, ship_from_line1, ship_from_line2, ship_from_city, ship_from_province, ship_from_postal_code, ship_from_country, ship_from_phone, shipping_handling_fee_cad, shop_pickup_enabled, shop_return_policy, canada_ship_attested_at, shop_status, marketplace_qa_status, marketplace_plan'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select(`id, ${SHIP_SELECT}`)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    await ensureMarketplaceIncludedFlags(admin, vendor.id)
    if (!(await vendorHasMarketplaceAccess(admin, vendor.id))) {
      return NextResponse.json({ error: 'Marketplace access required' }, { status: 403 })
    }

    const { data: refreshed } = await admin
      .from('vendor_profiles')
      .select(SHIP_SELECT)
      .eq('id', vendor.id)
      .single()

    const row = refreshed ?? vendor
    return NextResponse.json({
      settings: {
        ship_from_name: row.ship_from_name ?? '',
        ship_from_line1: row.ship_from_line1 ?? '',
        ship_from_line2: row.ship_from_line2 ?? '',
        ship_from_city: row.ship_from_city ?? '',
        ship_from_province: row.ship_from_province ?? '',
        ship_from_postal_code: row.ship_from_postal_code ?? '',
        ship_from_country: row.ship_from_country ?? 'CA',
        ship_from_phone: row.ship_from_phone ?? '',
        shipping_handling_fee_cad: Number(row.shipping_handling_fee_cad ?? 0),
        shop_pickup_enabled: Boolean(row.shop_pickup_enabled),
        shop_return_policy: row.shop_return_policy ?? '',
        canada_ship_attested: Boolean(row.canada_ship_attested_at),
        shop_status: row.shop_status ?? 'off',
        marketplace_qa_status: row.marketplace_qa_status ?? 'not_started',
        marketplace_plan: row.marketplace_plan ?? null,
      },
      publish_blockers: marketplacePublishBlockers(row),
      can_publish: canPublishShopProducts(row),
    })
  } catch (err) {
    console.error('marketplace shipping GET', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id, canada_ship_attested_at, marketplace_qa_status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    await ensureMarketplaceIncludedFlags(admin, vendor.id)
    if (!(await vendorHasMarketplaceAccess(admin, vendor.id))) {
      return NextResponse.json({ error: 'Marketplace access required' }, { status: 403 })
    }

    const parsed = shopShippingSettingsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    if (!data.canada_ship_attested) {
      return NextResponse.json(
        { error: 'You must attest that you ship from Canada and fulfill Canada-only orders.' },
        { status: 400 }
      )
    }

    const attestedAt = vendor.canada_ship_attested_at ?? new Date().toISOString()
    const qaStatus =
      !vendor.marketplace_qa_status || vendor.marketplace_qa_status === 'not_started'
        ? 'pending_review'
        : vendor.marketplace_qa_status

    const patch: Record<string, unknown> = {
      ship_from_name: data.ship_from_name.trim(),
      ship_from_line1: data.ship_from_line1.trim(),
      ship_from_line2: data.ship_from_line2?.trim() || null,
      ship_from_city: data.ship_from_city.trim(),
      ship_from_province: data.ship_from_province.trim(),
      ship_from_postal_code: data.ship_from_postal_code.trim().toUpperCase().replace(/\s+/g, ' '),
      ship_from_country: 'CA',
      ship_from_phone: data.ship_from_phone?.trim() || null,
      shipping_handling_fee_cad: data.shipping_handling_fee_cad,
      shop_pickup_enabled: data.shop_pickup_enabled,
      shop_return_policy: data.shop_return_policy?.trim() || null,
      canada_ship_attested_at: attestedAt,
      marketplace_qa_status: qaStatus,
      updated_at: new Date().toISOString(),
    }
    if (data.shop_status) patch.shop_status = data.shop_status

    const { error: upErr } = await admin.from('vendor_profiles').update(patch).eq('id', vendor.id)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('marketplace shipping PUT', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
