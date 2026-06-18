import 'server-only'

import type Stripe from 'stripe'
import {
  customerTaxAddressFromPostal,
  extractCanadianPostalFromFreeformAddress,
  type CustomerTaxAddress,
} from '@/lib/canadian-postal-province'
import { WORKSHOP_STRIPE_TAX_CODE } from '@/lib/stripe-tax-constants'
import { ensureConnectedAccountStripeTaxReady } from '@/lib/stripe-vendor-tax-setup'

export { WORKSHOP_STRIPE_TAX_CODE }

export type WorkshopTaxBreakdown = {
  calculationId: string
  subtotalCad: number
  taxCad: number
  totalCad: number
  amountTotalCents: number
}

export type CustomerAddressInput = {
  country?: string
  postal_code: string
  state?: string
  city?: string
  line1?: string
}

export function resolveCustomerTaxAddress(input: CustomerAddressInput): CustomerTaxAddress | null {
  const country = (input.country ?? 'CA').toUpperCase()
  if (country !== 'CA') return null
  return customerTaxAddressFromPostal(input.postal_code, {
    state: input.state,
    city: input.city,
    line1: input.line1,
  })
}

/** Profile postal, explicit body, then workshop venue address. */
export function resolveWorkshopCustomerTaxAddress(options: {
  customerAddress?: CustomerAddressInput | null
  profilePostalCode?: string | null
  eventLocation?: string | null
}): CustomerTaxAddress | null {
  if (options.customerAddress) {
    const fromBody = resolveCustomerTaxAddress(options.customerAddress)
    if (fromBody) return fromBody
  }
  if (options.profilePostalCode?.trim()) {
    const fromProfile = resolveCustomerTaxAddress({ postal_code: options.profilePostalCode })
    if (fromProfile) return fromProfile
  }
  if (options.eventLocation?.trim()) {
    const postal = extractCanadianPostalFromFreeformAddress(options.eventLocation)
    if (postal) {
      return resolveCustomerTaxAddress({ postal_code: postal })
    }
  }
  return null
}

function centsToCad(cents: number): number {
  return Math.round(cents) / 100
}

/** Ticket price with no GST/HST (vendor not registered / small supplier). */
export function buildWorkshopPriceBreakdownNoTax(subtotalCad: number): WorkshopTaxBreakdown {
  const subtotalCents = Math.round(subtotalCad * 100)
  return {
    calculationId: '',
    subtotalCad,
    taxCad: 0,
    totalCad: subtotalCad,
    amountTotalCents: subtotalCents,
  }
}

/**
 * Calculate tax for a workshop ticket on the connected vendor account (vendor tax liability).
 * @see https://docs.stripe.com/tax/tax-for-platforms#custom-flows-using-the-stripe-tax-api
 */
export async function calculateWorkshopTicketTax(
  stripe: Stripe,
  params: {
    connectedAccountId: string
    subtotalCad: number
    customerAddress: CustomerTaxAddress
    reference?: string
    vendorLocationAddress?: string | null
    gstHstRegistered: boolean
  }
): Promise<WorkshopTaxBreakdown> {
  if (!params.gstHstRegistered) {
    return buildWorkshopPriceBreakdownNoTax(params.subtotalCad)
  }

  const subtotalCents = Math.round(params.subtotalCad * 100)
  if (subtotalCents <= 0) {
    throw new Error('Subtotal must be positive for tax calculation')
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
          amount: subtotalCents,
          reference: params.reference ?? 'workshop_ticket',
          tax_code: WORKSHOP_STRIPE_TAX_CODE,
          tax_behavior: 'exclusive',
        },
      ],
      customer_details: {
        address: params.customerAddress,
        address_source: 'billing',
      },
    },
    { stripeAccount: params.connectedAccountId }
  )

  const taxCents =
    calculation.tax_amount_exclusive ??
    calculation.tax_amount_inclusive ??
    0

  if (!calculation.id) {
    throw new Error('Stripe Tax calculation did not return an id')
  }

  return {
    calculationId: calculation.id,
    subtotalCad: params.subtotalCad,
    taxCad: centsToCad(taxCents),
    totalCad: centsToCad(calculation.amount_total),
    amountTotalCents: calculation.amount_total,
  }
}

/** Record tax on the vendor account after payment succeeds. */
export async function commitWorkshopTaxTransaction(
  stripe: Stripe,
  params: { connectedAccountId: string; calculationId: string; reference: string }
): Promise<void> {
  await stripe.tax.transactions.createFromCalculation(
    {
      calculation: params.calculationId,
      reference: params.reference,
    },
    { stripeAccount: params.connectedAccountId }
  )
}

/** Reverse a committed workshop tax transaction when a booking is refunded. */
export async function reverseWorkshopTaxTransaction(
  stripe: Stripe,
  params: { connectedAccountId: string; paymentIntentId: string }
): Promise<void> {
  const listed = await stripe.tax.transactions.list(
    { limit: 25 },
    { stripeAccount: params.connectedAccountId }
  )
  const original = listed.data.find(
    (tx) => tx.reference === params.paymentIntentId && tx.type !== 'reversal'
  )
  if (!original?.id) return

  await stripe.tax.transactions.createReversal(
    {
      mode: 'full',
      original_transaction: original.id,
      reference: `${params.paymentIntentId}_refund`,
    },
    { stripeAccount: params.connectedAccountId }
  )
}
