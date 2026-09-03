import 'server-only'

import { customerTaxAddressFromPostal } from '@/lib/canadian-postal-province'
import { calculateShopOrderTax } from '@/lib/stripe-shop-tax'
import { shopCheckoutBodySchema } from '@/lib/shop/checkout-schema'
import {
  loadPublishedShopProduct,
  shopHighValueFlags,
  vendorPickupAddress,
  vendorShipFromAddress,
  type ShopVendorForCheckout,
} from '@/lib/shop/checkout'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { z } from 'zod'
import Stripe from 'stripe'
import { estimateCanadianStripeFee } from '@/lib/stripe-charge-fees'
import { shopPlatformFeeCents } from '@/lib/shop/fees'

export type ShopCheckoutBody = z.infer<typeof shopCheckoutBodySchema>

export type ShopCheckoutPricing = {
  itemSubtotalCad: number
  shippingCad: number
  taxCad: number
  totalCad: number
  amountTotalCents: number
  taxCalculationId: string
  platformFeeCents: number
  estimatedStripeFeeCents: number
  applicationFeeAmount: number
  shippoRateId: string | null
  shippoShipmentId: string | null
  highValue: ReturnType<typeof shopHighValueFlags>
  shipByBusinessDays: number
  madeToOrder: boolean
}

export async function resolveShopCheckoutPricing(
  admin: SupabaseClient,
  stripe: Stripe,
  body: ShopCheckoutBody,
  vendor: ShopVendorForCheckout,
  product: NonNullable<Awaited<ReturnType<typeof loadPublishedShopProduct>>>['product']
): Promise<ShopCheckoutPricing> {
  const itemSubtotalCad = product.price_cad
  const highValue = shopHighValueFlags(itemSubtotalCad)

  let shippingCad = 0
  let shippoRateId: string | null = null
  let shippoShipmentId: string | null = null

  if (body.fulfillment_type === 'pickup') {
    if (!product.pickup_available || !vendor.shop_pickup_enabled) {
      throw new CheckoutPricingError('Pickup is not available for this item', 422)
    }
    const pickupAddr = vendorPickupAddress(vendor)
    if (!pickupAddr) {
      throw new CheckoutPricingError('Seller pickup location is not configured', 422)
    }
  } else {
    if (!body.ship_address) {
      throw new CheckoutPricingError('Shipping address required', 422)
    }
    if (!body.shippo_rate_id || !body.shippo_shipment_id || body.shippo_rate_amount_cad == null) {
      throw new CheckoutPricingError('Select a shipping rate', 422)
    }

    const shipFrom = vendorShipFromAddress(vendor)
    if (!shipFrom) {
      throw new CheckoutPricingError('Seller shipping address is not configured', 422)
    }

    shippingCad = Math.round(body.shippo_rate_amount_cad * 100) / 100
    if (!(shippingCad >= 0) || !Number.isFinite(shippingCad)) {
      throw new CheckoutPricingError('Invalid shipping rate amount', 422)
    }
    shippoRateId = body.shippo_rate_id
    shippoShipmentId = body.shippo_shipment_id
  }

  const customerTaxAddr =
    body.fulfillment_type === 'ship' && body.ship_address
      ? customerTaxAddressFromPostal(body.ship_address.postal_code, {
          state: body.ship_address.province,
          city: body.ship_address.city,
          line1: body.ship_address.line1,
        })
      : body.fulfillment_type === 'pickup'
        ? (() => {
            const pickup = vendorPickupAddress(vendor)
            if (!pickup) return null
            return customerTaxAddressFromPostal(pickup.postal_code, {
              state: pickup.province,
              city: pickup.city,
              line1: pickup.line1,
            })
          })()
        : null

  if (!customerTaxAddr) {
    throw new CheckoutPricingError('Valid Canadian address required for tax calculation', 422)
  }

  let taxBreakdown
  try {
    taxBreakdown = await calculateShopOrderTax(stripe, {
      itemSubtotalCad,
      shippingCad,
      customerAddress: customerTaxAddr,
      reference: `shop_product_${product.id}`,
    })
  } catch (taxErr) {
    console.error('Shop tax calculation error:', taxErr)
    const detail = taxErr instanceof Stripe.errors.StripeError ? taxErr.message : undefined
    throw new CheckoutPricingError(detail ?? 'Could not calculate tax for this order.', 422)
  }

  const platformFeeCents = shopPlatformFeeCents(Math.round(itemSubtotalCad * 100))
  const estimatedStripeFeeCents = Math.min(
    taxBreakdown.amountTotalCents,
    Math.max(0, Math.round(estimateCanadianStripeFee(taxBreakdown.totalCad).feeCad * 100))
  )

  let applicationFeeAmount = platformFeeCents + estimatedStripeFeeCents

  try {
    const connectedAccount = await stripe.accounts.retrieve(vendor.stripe_account_id!)
    const feePayer = connectedAccount.controller?.fees?.payer
    if (feePayer === 'account') {
      applicationFeeAmount = platformFeeCents
    }
  } catch {
    /* keep combined fee */
  }

  applicationFeeAmount = Math.min(
    Math.max(0, applicationFeeAmount),
    Math.max(0, taxBreakdown.amountTotalCents - 1)
  )

  return {
    itemSubtotalCad,
    shippingCad,
    taxCad: taxBreakdown.taxCad,
    totalCad: taxBreakdown.totalCad,
    amountTotalCents: taxBreakdown.amountTotalCents,
    taxCalculationId: taxBreakdown.calculationId,
    platformFeeCents,
    estimatedStripeFeeCents,
    applicationFeeAmount,
    shippoRateId,
    shippoShipmentId,
    highValue,
    shipByBusinessDays: product.ship_by_business_days,
    madeToOrder: product.made_to_order,
  }
}

export class CheckoutPricingError extends Error {
  status: number
  constructor(message: string, status = 422) {
    super(message)
    this.status = status
  }
}
