import { resolveApiUser } from '@/lib/api-auth-user'
import {
  customerTaxAddressFromPostal,
  defaultCityForCanadianProvince,
} from '@/lib/canadian-postal-province'
import { isKillSwitchActive, killSwitchResponse } from '@/lib/kill-switch'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { shopRatesBodySchema } from '@/lib/shop/checkout-schema'
import {
  loadPublishedShopProduct,
  shopHighValueFlags,
  vendorShipFromAddress,
} from '@/lib/shop/checkout'
import { fetchShippoRates, isShippoConfigured } from '@/lib/shop/shippo'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const RATES_LIMIT = 30

export async function POST(request: NextRequest) {
  if (isKillSwitchActive()) return killSwitchResponse('/api/shop/rates')

  try {
    const key = getRateLimitKey(request)
    const rl = consumeRateLimit(`shop-rates:${key}`, RATES_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    const raw = await request.json()
    const parsed = shopRatesBodySchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { product_id, fulfillment_type, postal_code } = parsed.data
    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const loaded = await loadPublishedShopProduct(admin, product_id)
    if (!loaded) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const { product, vendor } = loaded
    if (product.quantity < 1) {
      return NextResponse.json({ error: 'Out of stock' }, { status: 409 })
    }

    const itemSubtotalCad = product.price_cad
    const highValue = shopHighValueFlags(itemSubtotalCad)
    const handlingFee = Number(vendor.shipping_handling_fee_cad ?? 0)

    if (fulfillment_type === 'pickup') {
      if (!product.pickup_available || !vendor.shop_pickup_enabled) {
        return NextResponse.json({ error: 'Pickup is not available for this item' }, { status: 422 })
      }
      return NextResponse.json({
        fulfillment_type: 'pickup',
        shipping_cad: 0,
        handling_fee_cad: 0,
        rates: [],
        ship_by_business_days: product.ship_by_business_days,
        made_to_order: product.made_to_order,
        high_value: highValue,
      })
    }

    if (!postal_code) {
      return NextResponse.json({ error: 'Canadian postal code required for shipping' }, { status: 422 })
    }

    const shipFrom = vendorShipFromAddress(vendor)
    if (!shipFrom) {
      return NextResponse.json({ error: 'Seller shipping address is not configured' }, { status: 422 })
    }

    if (!isShippoConfigured()) {
      return NextResponse.json(
        { error: 'Shipping rates are temporarily unavailable. Try again later.' },
        { status: 503 }
      )
    }

    const taxAddr = customerTaxAddressFromPostal(postal_code)
    if (!taxAddr) {
      return NextResponse.json({ error: 'Enter a valid Canadian postal code' }, { status: 422 })
    }

    const destCity =
      taxAddr.city?.trim() || defaultCityForCanadianProvince(taxAddr.state)

    // Avoid identical origin/destination (Shippo often returns empty rates).
    const originPostal = shipFrom.postal_code.replace(/[\s-]/g, '').toUpperCase()
    const destPostal = taxAddr.postal_code.replace(/[\s-]/g, '').toUpperCase()
    if (originPostal === destPostal) {
      return NextResponse.json(
        {
          error:
            'Enter a destination postal code different from the seller ship-from address to get rates.',
        },
        { status: 422 }
      )
    }

    const { shipment_id, rates, messages } = await fetchShippoRates({
      from: shipFrom,
      to: {
        name: 'Recipient',
        line1: '123 Main Street',
        city: destCity,
        province: taxAddr.state,
        postal_code: taxAddr.postal_code,
        country: 'CA',
      },
      parcel: {
        weight_g: product.weight_g,
        length_cm: Number(product.length_cm),
        width_cm: Number(product.width_cm),
        height_cm: Number(product.height_cm),
      },
      itemSubtotalCad,
    })

    if (!rates.length) {
      return NextResponse.json(
        {
          error:
            messages ??
            'No shipping rates available. Confirm Canada Post is enabled on the Shippo account and seller weight/dims are valid.',
        },
        { status: 422 }
      )
    }

    const ratesWithHandling = rates.map((r) => ({
      ...r,
      amount_cad: Math.round((r.amount_cad + handlingFee) * 100) / 100,
      base_rate_cad: r.amount_cad,
      handling_fee_cad: handlingFee,
    }))

    // Optional auth — used for logging only in v1
    await resolveApiUser(request)

    return NextResponse.json({
      fulfillment_type: 'ship',
      shipment_id,
      shipping_cad: ratesWithHandling[0]?.amount_cad ?? 0,
      handling_fee_cad: handlingFee,
      rates: ratesWithHandling,
      ship_by_business_days: product.ship_by_business_days,
      made_to_order: product.made_to_order,
      high_value: highValue,
      postal_code: taxAddr.postal_code,
    })
  } catch (err) {
    console.error('shop rates POST', err)
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
