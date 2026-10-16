import 'server-only'

import type Stripe from 'stripe'
import type { CustomerTaxAddress } from '@/lib/canadian-postal-province'
import { SHOP_GOODS_STRIPE_TAX_CODE } from '@/lib/shop/tax-constants'
import { ensureConnectedAccountStripeTaxReady } from '@/lib/stripe-vendor-tax-setup'

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

/** Item + shipping with no GST/HST (vendor is not CRA-registered). */
export function buildShopPriceWithoutTax(
  itemSubtotalCad: number,
  shippingCad: number
): ShopTaxBreakdown {
  const amountTotalCents = Math.round(itemSubtotalCad * 100) + Math.round(shippingCad * 100)
  return {
    calculationId: '',
    itemSubtotalCad,
    shippingCad,
    taxCad: 0,
    totalCad: centsToCad(amountTotalCents),
    amountTotalCents,
  }
}

/**
 * Marketplace GST/HST on the **vendor Connect** account (vendor remits), matching workshops.
 * Collected only when the vendor is CRA-registered. Goods are line items; shipping must use
 * Stripe Tax `shipping_cost` (not a shipping tax-code line item).
 * @see https://docs.stripe.com/tax/custom#shipping-costs
 */
export async function calculateShopOrderTax(
  stripe: Stripe,
  params: {
    connectedAccountId: string
    itemSubtotalCad: number
    shippingCad: number
    customerAddress: CustomerTaxAddress
    reference?: string
    vendorLocationAddress?: string | null
    gstHstRegistered: boolean
  }
): Promise<ShopTaxBreakdown> {
  if (!params.gstHstRegistered) {
    return buildShopPriceWithoutTax(params.itemSubtotalCad, params.shippingCad)
  }

  const itemSubtotalCents = Math.round(params.itemSubtotalCad * 100)
  const shippingCents = Math.round(params.shippingCad * 100)
  if (itemSubtotalCents <= 0) {
    throw new Error('Item subtotal must be positive for tax calculation')
  }

  await ensureConnectedAccountStripeTaxReady(stripe, params.connectedAccountId, {
    locationAddress: params.vendorLocationAddress,
    gstHstRegistered: true,
  })

  const calculation = await stripe.tax.calculations.create(
    {
      currency: 'cad',
      line_items: [
        {
          amount: itemSubtotalCents,
          reference: params.reference ?? 'shop_item',
          tax_code: SHOP_GOODS_STRIPE_TAX_CODE,
          tax_behavior: 'exclusive',
        },
      ],
      ...(shippingCents > 0
        ? {
            shipping_cost: {
              amount: shippingCents,
              tax_behavior: 'exclusive' as const,
            },
          }
        : {}),
      customer_details: {
        address: params.customerAddress,
        address_source: 'shipping',
      },
    },
    { stripeAccount: params.connectedAccountId }
  )

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

/** Record Marketplace GST/HST on the vendor Connect account after payment succeeds. */
export async function commitShopTaxTransaction(
  stripe: Stripe,
  params: { connectedAccountId: string; calculationId: string; reference: string }
): Promise<string> {
  const tx = await stripe.tax.transactions.createFromCalculation(
    {
      calculation: params.calculationId,
      reference: params.reference,
    },
    {
      stripeAccount: params.connectedAccountId,
      idempotencyKey: `shop_tax_${params.reference}`,
    }
  )
  if (!tx.id) {
    throw new Error('Stripe Tax transaction did not return an id')
  }
  return tx.id
}

/** Reverse a committed Marketplace tax transaction when an order is refunded. */
export async function reverseShopTaxTransaction(
  stripe: Stripe,
  params: { connectedAccountId: string; taxTransactionId: string; paymentIntentId: string }
): Promise<void> {
  await stripe.tax.transactions.createReversal(
    {
      mode: 'full',
      original_transaction: params.taxTransactionId,
      reference: `${params.paymentIntentId}_shop_refund`,
    },
    { stripeAccount: params.connectedAccountId }
  )
}
