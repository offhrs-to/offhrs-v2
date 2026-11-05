import 'server-only'

import type Stripe from 'stripe'
import type { CustomerTaxAddress } from '@/lib/canadian-postal-province'
import { SHOP_GOODS_STRIPE_TAX_CODE } from '@/lib/shop/tax-constants'
import { ensureConnectedAccountStripeTaxReady } from '@/lib/stripe-vendor-tax-setup'

/** Who remits Marketplace GST/HST after collection at checkout (CPA Nov 2026). */
export type ShopTaxRemitter = 'vendor' | 'platform'

export type ShopTaxBreakdown = {
  calculationId: string
  itemSubtotalCad: number
  shippingCad: number
  taxCad: number
  totalCad: number
  amountTotalCents: number
  /** Vendor Connect remits vs offhrs remits (unregistered sellers). */
  remitter: ShopTaxRemitter
}

function centsToCad(cents: number): number {
  return Math.round(cents) / 100
}

/** @deprecated Prefer always calculating tax; kept for tests/helpers. */
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
    remitter: 'platform',
  }
}

const PLATFORM_HEAD_OFFICE: CustomerTaxAddress = {
  country: 'CA',
  postal_code: 'M5H 2N2',
  state: 'ON',
}

/**
 * Ensure Stripe Tax is active on the **platform** account (offhrs remits for
 * unregistered Marketplace sellers).
 */
export async function ensurePlatformStripeTaxReady(stripe: Stripe): Promise<void> {
  let settings: Stripe.Tax.Settings
  try {
    settings = await stripe.tax.settings.retrieve()
  } catch (err) {
    console.warn('Platform Stripe Tax settings retrieve failed:', err)
    settings = { status: 'pending' } as Stripe.Tax.Settings
  }

  if (settings.status !== 'active') {
    await stripe.tax.settings.update({
      head_office: { address: PLATFORM_HEAD_OFFICE },
      defaults: {
        tax_code: SHOP_GOODS_STRIPE_TAX_CODE,
        tax_behavior: 'exclusive',
      },
    })
  }

  let registrations: Stripe.Tax.Registration[] = []
  try {
    const listed = await stripe.tax.registrations.list({ status: 'active', limit: 100 })
    registrations = listed.data
  } catch (err) {
    console.warn('Platform Stripe Tax registrations list failed:', err)
  }

  const hasCaGstHst = registrations.some(
    (r) =>
      r.country === 'CA' &&
      r.country_options?.ca?.type &&
      ['standard', 'simplified'].includes(r.country_options.ca.type)
  )

  if (!hasCaGstHst) {
    try {
      await stripe.tax.registrations.create({
        country: 'CA',
        active_from: 'now',
        country_options: { ca: { type: 'standard' } },
      })
    } catch (err) {
      console.warn('Platform Stripe Tax CA standard registration:', err)
    }
  }
}

/**
 * Marketplace GST/HST on every sale (CPA Nov 2026).
 * - Registered vendor → calculate on Connect; remitter `vendor`
 * - Unregistered → calculate on platform account; remitter `platform` (fee keeps tax)
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
  const itemSubtotalCents = Math.round(params.itemSubtotalCad * 100)
  const shippingCents = Math.round(params.shippingCad * 100)
  if (itemSubtotalCents <= 0) {
    throw new Error('Item subtotal must be positive for tax calculation')
  }

  const remitter: ShopTaxRemitter = params.gstHstRegistered ? 'vendor' : 'platform'
  const requestOptions =
    remitter === 'vendor' ? { stripeAccount: params.connectedAccountId } : undefined

  if (remitter === 'vendor') {
    await ensureConnectedAccountStripeTaxReady(stripe, params.connectedAccountId, {
      locationAddress: params.vendorLocationAddress,
      gstHstRegistered: true,
    })
  } else {
    await ensurePlatformStripeTaxReady(stripe)
  }

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
    requestOptions
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
    remitter,
  }
}

/** Record Marketplace GST/HST after payment (Connect or platform). */
export async function commitShopTaxTransaction(
  stripe: Stripe,
  params: {
    calculationId: string
    reference: string
    remitter: ShopTaxRemitter
    connectedAccountId?: string | null
  }
): Promise<string> {
  const requestOptions =
    params.remitter === 'vendor'
      ? {
          stripeAccount: params.connectedAccountId!,
          idempotencyKey: `shop_tax_${params.reference}`,
        }
      : { idempotencyKey: `shop_tax_platform_${params.reference}` }

  if (params.remitter === 'vendor' && !params.connectedAccountId) {
    throw new Error('Missing vendor Stripe account for shop tax commit')
  }

  const tx = await stripe.tax.transactions.createFromCalculation(
    {
      calculation: params.calculationId,
      reference: params.reference,
    },
    requestOptions
  )
  if (!tx.id) {
    throw new Error('Stripe Tax transaction did not return an id')
  }
  return tx.id
}

/** Reverse a committed Marketplace tax transaction when an order is refunded. */
export async function reverseShopTaxTransaction(
  stripe: Stripe,
  params: {
    taxTransactionId: string
    paymentIntentId: string
    remitter: ShopTaxRemitter
    connectedAccountId?: string | null
  }
): Promise<void> {
  const requestOptions =
    params.remitter === 'vendor'
      ? { stripeAccount: params.connectedAccountId! }
      : undefined

  if (params.remitter === 'vendor' && !params.connectedAccountId) {
    throw new Error('Missing vendor Stripe account for shop tax reversal')
  }

  await stripe.tax.transactions.createReversal(
    {
      mode: 'full',
      original_transaction: params.taxTransactionId,
      reference: `${params.paymentIntentId}_shop_refund`,
    },
    requestOptions
  )
}
