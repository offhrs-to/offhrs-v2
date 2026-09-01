import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  SHOP_HIGH_VALUE_INSURANCE_CAD,
} from '@/lib/shop/fees'

export type ShopProductForCheckout = {
  id: string
  vendor_id: string
  title: string
  price_cad: number
  quantity: number
  weight_g: number
  length_cm: number
  width_cm: number
  height_cm: number
  pickup_available: boolean
  made_to_order: boolean
  ship_by_business_days: number
  buyer_remorse_returns: boolean
  status: string
  image_urls: string[]
}

export type ShopVendorForCheckout = {
  id: string
  business_name: string | null
  stripe_account_id: string | null
  ship_from_name: string | null
  ship_from_line1: string | null
  ship_from_line2: string | null
  ship_from_city: string | null
  ship_from_province: string | null
  ship_from_postal_code: string | null
  ship_from_country: string | null
  ship_from_phone: string | null
  shipping_handling_fee_cad: number | null
  shop_pickup_enabled: boolean
  marketplace_enabled: boolean
  shop_status: string
  marketplace_qa_status: string
  status: string
}

export async function loadPublishedShopProduct(
  admin: SupabaseClient,
  productId: string
): Promise<{ product: ShopProductForCheckout; vendor: ShopVendorForCheckout } | null> {
  const { data: product, error } = await admin
    .from('shop_products')
    .select(
      'id, vendor_id, title, price_cad, quantity, weight_g, length_cm, width_cm, height_cm, pickup_available, made_to_order, ship_by_business_days, buyer_remorse_returns, status, image_urls'
    )
    .eq('id', productId)
    .eq('status', 'published')
    .maybeSingle()

  if (error || !product) return null

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select(
      'id, business_name, stripe_account_id, ship_from_name, ship_from_line1, ship_from_line2, ship_from_city, ship_from_province, ship_from_postal_code, ship_from_country, ship_from_phone, shipping_handling_fee_cad, shop_pickup_enabled, marketplace_enabled, shop_status, marketplace_qa_status, status'
    )
    .eq('id', product.vendor_id)
    .maybeSingle()

  if (!vendor) return null
  if (!vendor.marketplace_enabled || vendor.shop_status !== 'live') return null
  if (!['trialing', 'active', 'past_due'].includes(vendor.status ?? '')) return null
  if (vendor.marketplace_qa_status !== 'approved') return null
  if (!vendor.stripe_account_id) return null

  return {
    product: {
      ...product,
      price_cad: Number(product.price_cad),
    },
    vendor: {
      ...vendor,
      shipping_handling_fee_cad: Number(vendor.shipping_handling_fee_cad ?? 0),
    },
  }
}

export function shopHighValueFlags(itemSubtotalCad: number): {
  requires_signature: boolean
  requires_insurance: boolean
} {
  const high = itemSubtotalCad >= SHOP_HIGH_VALUE_INSURANCE_CAD
  return { requires_signature: high, requires_insurance: high }
}

export function vendorShipFromAddress(vendor: ShopVendorForCheckout) {
  if (
    !vendor.ship_from_name?.trim() ||
    !vendor.ship_from_line1?.trim() ||
    !vendor.ship_from_city?.trim() ||
    !vendor.ship_from_province?.trim() ||
    !vendor.ship_from_postal_code?.trim()
  ) {
    return null
  }
  return {
    name: vendor.ship_from_name.trim(),
    line1: vendor.ship_from_line1.trim(),
    line2: vendor.ship_from_line2,
    city: vendor.ship_from_city.trim(),
    province: vendor.ship_from_province.trim(),
    postal_code: vendor.ship_from_postal_code.trim(),
    country: vendor.ship_from_country?.trim() || 'CA',
    phone: vendor.ship_from_phone,
  }
}
