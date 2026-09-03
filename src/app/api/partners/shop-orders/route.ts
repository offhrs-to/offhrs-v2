import { createClient } from '@/lib/supabase/server'
import { canCancelShopOrder, shopOrderShipByAt } from '@/lib/shop/fulfillment'
import { resolveMarketplaceVendor } from '@/lib/shop/partner-context'
import { NextRequest, NextResponse } from 'next/server'

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
    let query = admin
      .from('shop_orders')
      .select(
        'id, product_id, product_title, status, fulfillment_type, buyer_name, buyer_email, ship_to_name, ship_to_line1, ship_to_line2, ship_to_city, ship_to_province, ship_to_postal_code, item_subtotal_cad, shipping_collected_cad, tax_cad, total_cad, ship_by_business_days, paid_at, created_at, tracking_number, tracking_url, tracking_status, shippo_label_url, first_scan_at, delivered_at, dropoff_receipt_at, picked_up_at, refunded_at, quantity'
      )
      .eq('vendor_id', vendor.id)
      .order('paid_at', { ascending: false, nullsFirst: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error: qErr } = await query.limit(80)
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

    const orders = (data ?? []).map((row) => ({
      ...row,
      item_subtotal_cad: Number(row.item_subtotal_cad),
      shipping_collected_cad: Number(row.shipping_collected_cad),
      tax_cad: Number(row.tax_cad),
      total_cad: Number(row.total_cad),
      ship_by_at: shopOrderShipByAt(row.paid_at, row.ship_by_business_days),
      can_print_label: row.fulfillment_type === 'ship' && ['paid_awaiting_fulfillment', 'label_purchased'].includes(row.status),
      can_mark_pickup: row.fulfillment_type === 'pickup' && row.status === 'paid_awaiting_fulfillment',
      can_confirm_dropoff: row.fulfillment_type === 'ship' && ['label_purchased', 'shipped'].includes(row.status) && !row.dropoff_receipt_at,
      can_refund: canCancelShopOrder(row),
    }))

    return NextResponse.json({ orders })
  } catch (err) {
    console.error('partners shop-orders GET', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
