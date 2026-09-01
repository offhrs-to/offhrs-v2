import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() ?? ''
    const category = searchParams.get('category')?.trim()
    const sort = searchParams.get('sort') ?? 'newest'
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const offset = Math.max(0, Number(searchParams.get('offset') ?? 0))

    let query = admin
      .from('shop_products')
      .select(
        'id, title, price_cad, category, image_urls, created_at, vendor_id, vendor_profiles!inner(business_name, slug, shop_status, marketplace_enabled, status, marketplace_qa_status)',
        { count: 'exact' }
      )
      .eq('status', 'published')
      .eq('vendor_profiles.marketplace_enabled', true)
      .eq('vendor_profiles.shop_status', 'live')
      .eq('vendor_profiles.marketplace_qa_status', 'approved')
      .in('vendor_profiles.status', ['trialing', 'active', 'past_due'])
      .gt('quantity', 0)

    if (category && category !== 'All') {
      query = query.eq('category', category)
    }

    if (q) {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    }

    if (sort === 'price_asc') {
      query = query.order('price_cad', { ascending: true })
    } else if (sort === 'price_desc') {
      query = query.order('price_cad', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)
    if (error) {
      console.error('shop products GET', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const products = (data ?? []).map((row) => {
      const vp = Array.isArray(row.vendor_profiles)
        ? row.vendor_profiles[0]
        : row.vendor_profiles
      return {
        id: row.id,
        title: row.title,
        price_cad: Number(row.price_cad),
        category: row.category,
        image_urls: row.image_urls ?? [],
        vendor_id: row.vendor_id,
        vendor_name: vp?.business_name ?? 'Maker',
        vendor_slug: vp?.slug ?? null,
        created_at: row.created_at,
      }
    })

    return NextResponse.json({ products, total: count ?? products.length })
  } catch (err) {
    console.error('shop products GET', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
