import 'server-only'

import type Stripe from 'stripe'
import { customerTaxAddressFromPostal, type CustomerTaxAddress } from '@/lib/canadian-postal-province'

/** Stripe product tax code — override via STRIPE_WORKSHOP_TAX_CODE (general services default). */
export const WORKSHOP_STRIPE_TAX_CODE =
  process.env.STRIPE_WORKSHOP_TAX_CODE?.trim() || 'txcd_20030000'

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

function centsToCad(cents: number): number {
  return Math.round(cents) / 100
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
  }
): Promise<WorkshopTaxBreakdown> {
  const subtotalCents = Math.round(params.subtotalCad * 100)
  if (subtotalCents <= 0) {
    throw new Error('Subtotal must be positive for tax calculation')
  }

  const calculation = await stripe.tax.calculations.create(
    {
      currency: 'cad',
      line_items: [
        {
          amount: subtotalCents,
          reference: params.reference ?? 'workshop_ticket',
          tax_code: WORKSHOP_STRIPE_TAX_CODE,
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
