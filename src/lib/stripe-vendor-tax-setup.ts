import 'server-only'

import type Stripe from 'stripe'
import {
  customerTaxAddressFromPostal,
  extractCanadianPostalFromFreeformAddress,
  provinceFromCanadianAddress,
  type CustomerTaxAddress,
} from '@/lib/canadian-postal-province'
import { WORKSHOP_STRIPE_TAX_CODE } from '@/lib/stripe-workshop-tax'

/** Fallback head office when vendor has no geocoded address (Toronto, ON). */
const DEFAULT_VENDOR_HEAD_OFFICE: CustomerTaxAddress = {
  country: 'CA',
  postal_code: 'M5H 2N2',
  state: 'ON',
}

export type VendorTaxSetupHints = {
  locationAddress?: string | null
}

function headOfficeFromVendorLocation(locationAddress?: string | null): CustomerTaxAddress {
  if (locationAddress?.trim()) {
    const postal = extractCanadianPostalFromFreeformAddress(locationAddress)
    if (postal) {
      const fromPostal = customerTaxAddressFromPostal(postal)
      if (fromPostal) return fromPostal
    }
    const state = provinceFromCanadianAddress(locationAddress)
    if (state) {
      return {
        country: 'CA',
        postal_code: DEFAULT_VENDOR_HEAD_OFFICE.postal_code,
        state,
        line1: locationAddress.trim().slice(0, 200),
      }
    }
  }
  return DEFAULT_VENDOR_HEAD_OFFICE
}

/**
 * Express Connect accounts often complete payouts before Stripe Tax is configured.
 * Without an active `tax.settings`, Tax Calculation API calls fail even though charges work.
 */
export async function ensureConnectedAccountStripeTaxReady(
  stripe: Stripe,
  connectedAccountId: string,
  hints: VendorTaxSetupHints = {}
): Promise<void> {
  const headOffice = headOfficeFromVendorLocation(hints.locationAddress)

  let settings: Stripe.Tax.Settings
  try {
    settings = await stripe.tax.settings.retrieve({}, { stripeAccount: connectedAccountId })
  } catch (err) {
    console.warn('Stripe Tax settings retrieve failed:', err)
    settings = { status: 'pending' } as Stripe.Tax.Settings
  }

  if (settings.status !== 'active') {
    await stripe.tax.settings.update(
      {
        head_office: { address: headOffice },
        defaults: {
          tax_code: WORKSHOP_STRIPE_TAX_CODE,
          tax_behavior: 'exclusive',
        },
      },
      { stripeAccount: connectedAccountId }
    )
  }

  // GST/HST (incl. Ontario) uses CA `standard` registration — not province_standard (PST/QST).
  let registrations: Stripe.Tax.Registration[] = []
  try {
    const listed = await stripe.tax.registrations.list(
      { status: 'active', limit: 100 },
      { stripeAccount: connectedAccountId }
    )
    registrations = listed.data
  } catch (err) {
    console.warn('Stripe Tax registrations list failed:', err)
  }

  const hasCaGstHst = registrations.some(
    (r) =>
      r.country === 'CA' &&
      r.country_options?.ca?.type &&
      ['standard', 'simplified'].includes(r.country_options.ca.type)
  )

  if (!hasCaGstHst) {
    try {
      await stripe.tax.registrations.create(
        {
          country: 'CA',
          active_from: 'now',
          country_options: { ca: { type: 'standard' } },
        },
        { stripeAccount: connectedAccountId }
      )
    } catch (err) {
      console.warn('Stripe Tax CA standard registration:', err)
    }
  }
}
