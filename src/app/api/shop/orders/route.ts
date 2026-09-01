import { resolveApiUser } from '@/lib/api-auth-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

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
        'id, product_id, product_title, product_price_cad, quantity, item_subtotal_cad, shipping_collected_cad, tax_cad, total_cad, status, fulfillment_type, ship_by_business_days, paid_at, created_at, vendor_id, vendor_profiles(business_name, slug)',
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

    const orders = (data ?? []).map((row) => {
      const vp = Array.isArray(row.vendor_profiles)
        ? row.vendor_profiles[0]
        : row.vendor_profiles
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
      }
    })

    return NextResponse.json({ orders, total: count ?? orders.length })
  } catch (err) {
    console.error('shop orders GET', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
