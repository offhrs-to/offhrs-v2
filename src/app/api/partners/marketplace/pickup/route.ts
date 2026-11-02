import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  ensureMarketplaceIncludedFlags,
  vendorHasMarketplaceAccess,
} from '@/lib/shop/access'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const pickupSchema = z
  .object({
    shop_pickup_enabled: z.boolean(),
    shop_pickup_line1: z.string().max(200).optional().nullable(),
    shop_pickup_line2: z.string().max(200).optional().nullable(),
    shop_pickup_city: z.string().max(100).optional().nullable(),
    shop_pickup_province: z.string().max(40).optional().nullable(),
    shop_pickup_postal_code: z.string().max(12).optional().nullable(),
    shop_pickup_hours: z.string().max(500).optional().nullable(),
    shop_pickup_arrange_by_contact: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.shop_pickup_enabled) return
    if (!data.shop_pickup_line1?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Pickup address line 1 is required',
        path: ['shop_pickup_line1'],
      })
    }
    if (!data.shop_pickup_city?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Pickup city is required', path: ['shop_pickup_city'] })
    }
    if (!data.shop_pickup_province?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Pickup province is required',
        path: ['shop_pickup_province'],
      })
    }
    const postal = data.shop_pickup_postal_code?.trim() ?? ''
    if (!postal) {
      ctx.addIssue({
        code: 'custom',
        message: 'Pickup postal code is required',
        path: ['shop_pickup_postal_code'],
      })
    } else if (
      !/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ ]?\d[ABCEGHJ-NPRSTV-Z]\d$/i.test(postal)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a valid Canadian postal code',
        path: ['shop_pickup_postal_code'],
      })
    }
    const arrange = data.shop_pickup_arrange_by_contact === true
    if (!arrange && !data.shop_pickup_hours?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Add pickup hours, or check “Contact seller to arrange pickup”',
        path: ['shop_pickup_hours'],
      })
    }
  })

/**
 * PUT /api/partners/marketplace/pickup
 * Lightweight pickup-location update from the product form (does not re-attest shipping).
 */
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
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    await ensureMarketplaceIncludedFlags(admin, vendor.id)
    if (!(await vendorHasMarketplaceAccess(admin, vendor.id))) {
      return NextResponse.json({ error: 'Marketplace access required' }, { status: 403 })
    }

    const parsed = pickupSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0]
      return NextResponse.json(
        { error: first || 'Validation failed', fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const arrange = data.shop_pickup_arrange_by_contact === true
    const patch: Record<string, unknown> = {
      shop_pickup_enabled: data.shop_pickup_enabled,
      shop_pickup_line1: data.shop_pickup_enabled ? data.shop_pickup_line1?.trim() || null : null,
      shop_pickup_line2: data.shop_pickup_enabled ? data.shop_pickup_line2?.trim() || null : null,
      shop_pickup_city: data.shop_pickup_enabled ? data.shop_pickup_city?.trim() || null : null,
      shop_pickup_province: data.shop_pickup_enabled
        ? data.shop_pickup_province?.trim() || null
        : null,
      shop_pickup_postal_code: data.shop_pickup_enabled
        ? data.shop_pickup_postal_code?.trim().toUpperCase().replace(/\s+/g, ' ') || null
        : null,
      shop_pickup_hours: data.shop_pickup_enabled
        ? arrange
          ? data.shop_pickup_hours?.trim() || null
          : data.shop_pickup_hours?.trim() || null
        : null,
      shop_pickup_arrange_by_contact: data.shop_pickup_enabled ? arrange : false,
      updated_at: new Date().toISOString(),
    }

    const { error: upErr } = await admin.from('vendor_profiles').update(patch).eq('id', vendor.id)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('marketplace pickup PUT', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
