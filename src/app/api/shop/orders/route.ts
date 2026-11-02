import { resolveApiUser } from '@/lib/api-auth-user'
import { canCancelShopOrder } from '@/lib/shop/fulfillment'
import { vendorContactEmailForUserId } from '@/lib/shop/vendor-contact'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

function formatPickupAddress(vp: {
  shop_pickup_line1?: string | null
  shop_pickup_line2?: string | null
  shop_pickup_city?: string | null
  shop_pickup_province?: string | null
  shop_pickup_postal_code?: string | null
} | null): string | null {
  if (!vp?.shop_pickup_line1?.trim() || !vp.shop_pickup_city?.trim()) return null
  const cityLine = [vp.shop_pickup_city.trim(), vp.shop_pickup_province?.trim(), vp.shop_pickup_postal_code?.trim()]
    .filter(Boolean)
    .join(', ')
  return [vp.shop_pickup_line1.trim(), vp.shop_pickup_line2?.trim() || null, cityLine]
    .filter(Boolean)
    .join('\n')
}

export async function GET(request: NextRequest) {
  try {
    const user = await resolveApiUser(request)
    if (!user?.id) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const offset = Math.max(0, Number(searchParams.get('offset') ?? 0))

    const { data, error, count } = await admin
      .from('shop_orders')
      .select(
        'id, product_id, product_title, product_price_cad, quantity, item_subtotal_cad, shipping_collected_cad, tax_cad, total_cad, status, fulfillment_type, ship_by_business_days, paid_at, created_at, vendor_id, tracking_number, tracking_url, tracking_status, first_scan_at, delivered_at, picked_up_at, vendor_profiles(business_name, slug, user_id, shop_pickup_line1, shop_pickup_line2, shop_pickup_city, shop_pickup_province, shop_pickup_postal_code, shop_pickup_hours, shop_pickup_arrange_by_contact)',
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('paid_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('shop orders GET', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data ?? []
    const emailByUserId = new Map<string, string | null>()
    for (const row of rows) {
      const vp = Array.isArray(row.vendor_profiles) ? row.vendor_profiles[0] : row.vendor_profiles
      const uid = vp?.user_id as string | undefined
      if (uid && !emailByUserId.has(uid)) {
        emailByUserId.set(uid, await vendorContactEmailForUserId(admin, uid))
      }
    }

    const orders = rows.map((row) => {
      const vp = Array.isArray(row.vendor_profiles) ? row.vendor_profiles[0] : row.vendor_profiles
      const uid = (vp?.user_id as string | undefined) ?? null
      const isPickup = row.fulfillment_type === 'pickup'
      return {
        id: row.id,
        product_id: row.product_id,
        product_title: row.product_title,
        product_price_cad: Number(row.product_price_cad),
        quantity: row.quantity,
        item_subtotal_cad: Number(row.item_subtotal_cad),
        shipping_collected_cad: Number(row.shipping_collected_cad),
        tax_cad: Number(row.tax_cad),
        total_cad: Number(row.total_cad),
        status: row.status,
        fulfillment_type: row.fulfillment_type,
        ship_by_business_days: row.ship_by_business_days,
        paid_at: row.paid_at,
        created_at: row.created_at,
        vendor_id: row.vendor_id,
        vendor_name: vp?.business_name ?? 'Maker',
        vendor_slug: vp?.slug ?? null,
        vendor_contact_email: uid ? emailByUserId.get(uid) ?? null : null,
        pickup_address: isPickup ? formatPickupAddress(vp) : null,
        pickup_arrange_by_contact: isPickup
          ? Boolean(vp?.shop_pickup_arrange_by_contact)
          : false,
        pickup_hours: isPickup
          ? vp?.shop_pickup_arrange_by_contact
            ? null
            : (vp?.shop_pickup_hours ?? null)
          : null,
        tracking_number: row.tracking_number ?? null,
        tracking_url: row.tracking_url ?? null,
        tracking_status: row.tracking_status ?? null,
        first_scan_at: row.first_scan_at ?? null,
        delivered_at: row.delivered_at ?? null,
        picked_up_at: row.picked_up_at ?? null,
        can_cancel: canCancelShopOrder({
          first_scan_at: row.first_scan_at ?? null,
          status: row.status,
        }),
      }
    })

    return NextResponse.json({ orders, total: count ?? orders.length })
  } catch (err) {
    console.error('shop orders GET', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
