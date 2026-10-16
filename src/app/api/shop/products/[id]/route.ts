import { resolveApiUser } from '@/lib/api-auth-user'
import {
  currentShopTermsVersion,
  formatSellerDisclosureAddress,
  shopCancelReturnDisclosure,
  shopDeliveryDisclosure,
  SHOP_SUPPORT_EMAIL,
  SHOP_TERMS_OF_USE_URL,
} from '@/lib/shop/ontario-disclosures'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

const PRODUCT_SELECT =
  'id, title, description, price_cad, category, quantity, status, weight_g, length_cm, width_cm, height_cm, fragile, pickup_available, made_to_order, ship_by_business_days, buyer_remorse_returns, image_urls, created_at, vendor_id'

const VENDOR_SELECT =
  'id, business_name, slug, bio, website_url, location_address, shop_pickup_enabled, shop_pickup_line1, shop_pickup_line2, shop_pickup_city, shop_pickup_province, shop_pickup_postal_code, shop_pickup_hours, ship_from_line1, ship_from_line2, ship_from_city, ship_from_province, ship_from_postal_code, ship_from_country, marketplace_enabled, shop_status, marketplace_qa_status, status'

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
  const sellerAddress = formatSellerDisclosureAddress({
    shipFrom: vendor
      ? {
          line1: vendor.ship_from_line1 as string | null,
          line2: vendor.ship_from_line2 as string | null,
          city: vendor.ship_from_city as string | null,
          province: vendor.ship_from_province as string | null,
          postal_code: vendor.ship_from_postal_code as string | null,
          country: vendor.ship_from_country as string | null,
        }
      : null,
    locationAddress: (vendor?.location_address as string | null) ?? null,
  })
  const shipBy = Number(product.ship_by_business_days ?? 5)
  const madeToOrder = product.made_to_order === true
  const buyerRemorse = product.buyer_remorse_returns !== false
  const pickupHours = (vendor?.shop_pickup_hours as string | null) ?? null

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
          website_url: vendor.website_url ?? null,
          shop_pickup_enabled: shopPickupEnabled,
          shop_pickup_line1: vendor.shop_pickup_line1 ?? null,
          shop_pickup_line2: vendor.shop_pickup_line2 ?? null,
          shop_pickup_city: vendor.shop_pickup_city ?? null,
          shop_pickup_province: vendor.shop_pickup_province ?? null,
          shop_pickup_postal_code: vendor.shop_pickup_postal_code ?? null,
          shop_pickup_hours: pickupHours,
        }
      : null,
    purchase_disclosures: {
      seller_name: (vendor?.business_name as string | null)?.trim() || 'Maker',
      seller_address: sellerAddress,
      seller_website: (vendor?.website_url as string | null)?.trim() || null,
      delivery_ship: shopDeliveryDisclosure({
        fulfillmentType: 'ship',
        shipByDays: shipBy,
        madeToOrder,
      }),
      delivery_pickup: shopDeliveryDisclosure({
        fulfillmentType: 'pickup',
        pickupHours,
      }),
      cancel_return_ship: shopCancelReturnDisclosure({
        fulfillmentType: 'ship',
        buyerRemorseReturns: buyerRemorse,
      }),
      cancel_return_pickup: shopCancelReturnDisclosure({
        fulfillmentType: 'pickup',
        buyerRemorseReturns: buyerRemorse,
      }),
      support_email: SHOP_SUPPORT_EMAIL,
      terms_version: currentShopTermsVersion(),
      terms_url: SHOP_TERMS_OF_USE_URL,
    },
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
