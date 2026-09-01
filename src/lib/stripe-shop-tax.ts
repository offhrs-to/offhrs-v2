import 'server-only'

import type Stripe from 'stripe'
import type { CustomerTaxAddress } from '@/lib/canadian-postal-province'
import { SHOP_GOODS_STRIPE_TAX_CODE } from '@/lib/shop/tax-constants'

/** Stripe Tax code for shipping/freight (buyer-paid postage). */
const SHOP_SHIPPING_STRIPE_TAX_CODE = 'txcd_92010001'

export type ShopTaxBreakdown = {
  calculationId: string
  itemSubtotalCad: number
  shippingCad: number
  taxCad: number
  totalCad: number
  amountTotalCents: number
}

function centsToCad(cents: number): number {
  return Math.round(cents) / 100
}

/**
 * Marketplace facilitator tax on the **platform** Stripe account (not vendor Connect).
 * Item subtotal + shipping are taxed separately per Stripe Tax line items.
 */
export async function calculateShopOrderTax(
  stripe: Stripe,
  params: {
    itemSubtotalCad: number
    shippingCad: number
    customerAddress: CustomerTaxAddress
    reference?: string
  }
): Promise<ShopTaxBreakdown> {
  const itemSubtotalCents = Math.round(params.itemSubtotalCad * 100)
  const shippingCents = Math.round(params.shippingCad * 100)
  if (itemSubtotalCents <= 0) {
    throw new Error('Item subtotal must be positive for tax calculation')
  }

  const lineItems: Array<{
    amount: number
    reference: string
    tax_code: string
    tax_behavior: 'exclusive' | 'inclusive'
  }> = [
    {
      amount: itemSubtotalCents,
      reference: params.reference ?? 'shop_item',
      tax_code: SHOP_GOODS_STRIPE_TAX_CODE,
      tax_behavior: 'exclusive',
    },
  ]

  if (shippingCents > 0) {
    lineItems.push({
      amount: shippingCents,
      reference: 'shop_shipping',
      tax_code: SHOP_SHIPPING_STRIPE_TAX_CODE,
      tax_behavior: 'exclusive',
    })
  }

  const calculation = await stripe.tax.calculations.create({
    currency: 'cad',
    line_items: lineItems,
    customer_details: {
      address: params.customerAddress,
      address_source: 'shipping',
    },
  })

  const taxCents =
    calculation.tax_amount_exclusive ?? calculation.tax_amount_inclusive ?? 0

  if (!calculation.id) {
    throw new Error('Stripe Tax calculation did not return an id')
  }

  return {
    calculationId: calculation.id,
    itemSubtotalCad: params.itemSubtotalCad,
    shippingCad: params.shippingCad,
    taxCad: centsToCad(taxCents),
    totalCad: centsToCad(calculation.amount_total),
    amountTotalCents: calculation.amount_total,
  }
}

/** Record facilitator tax on the platform account after payment succeeds. */
export async function commitShopTaxTransaction(
  stripe: Stripe,
  params: { calculationId: string; reference: string }
): Promise<string> {
  const tx = await stripe.tax.transactions.createFromCalculation(
    {
      calculation: params.calculationId,
      reference: params.reference,
    },
    { idempotencyKey: `shop_tax_${params.reference}` }
  )
  return tx.id
}
