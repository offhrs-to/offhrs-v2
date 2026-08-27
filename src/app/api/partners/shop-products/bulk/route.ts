import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  ensureMarketplaceIncludedFlags,
  vendorHasMarketplaceAccess,
} from '@/lib/shop/access'
import { marketplacePublishBlockers } from '@/lib/shop/publish-gates'

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['archive', 'publish', 'draft']),
})

export async function POST(request: NextRequest) {
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
      .select(
        'id, ship_from_name, ship_from_line1, ship_from_city, ship_from_province, ship_from_postal_code, ship_from_country, canada_ship_attested_at, marketplace_qa_status, shop_pickup_enabled'
      )
      .eq('user_id', user.id)
      .maybeSingle()

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    await ensureMarketplaceIncludedFlags(admin, vendor.id)
    if (!(await vendorHasMarketplaceAccess(admin, vendor.id))) {
      return NextResponse.json({ error: 'Marketplace access required' }, { status: 403 })
    }

    const { data: refreshed } = await admin
      .from('vendor_profiles')
      .select(
        'id, ship_from_name, ship_from_line1, ship_from_city, ship_from_province, ship_from_postal_code, ship_from_country, canada_ship_attested_at, marketplace_qa_status, shop_pickup_enabled'
      )
      .eq('id', vendor.id)
      .single()

    const shipVendor = refreshed ?? vendor

    const parsed = bulkSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { ids, action } = parsed.data
    const uniqueIds = [...new Set(ids)]

    if (action === 'publish') {
      const blockers = marketplacePublishBlockers(shipVendor)
      if (blockers.length) {
        return NextResponse.json({ error: blockers[0], blockers }, { status: 400 })
      }
    }

    const nextStatus =
      action === 'publish' ? 'published' : action === 'draft' ? 'draft' : 'archived'

    const { data: rows, error: fetchError } = await admin
      .from('shop_products')
      .select('id, status')
      .eq('vendor_id', shipVendor.id)
      .in('id', uniqueIds)

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

    const owned = new Set((rows ?? []).map((r) => r.id as string))
    const succeeded: string[] = []
    const skipped: { id: string; reason: string }[] = []
    const failed: { id: string; error: string }[] = []

    for (const id of uniqueIds) {
      if (!owned.has(id)) {
        skipped.push({ id, reason: 'not_found' })
        continue
      }
      const { error: upErr } = await admin
        .from('shop_products')
        .update({ status: nextStatus })
        .eq('id', id)
        .eq('vendor_id', shipVendor.id)

      if (upErr) failed.push({ id, error: upErr.message })
      else succeeded.push(id)
    }

    return NextResponse.json({ succeeded, skipped, failed })
  } catch (err) {
    console.error('shop-products bulk', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
