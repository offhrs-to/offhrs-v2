import 'server-only'

import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Self-healing reconciler for Stripe Connect Express onboarding state.
 *
 * The `account.updated` webhook is the canonical signal that flips
 * `vendor_profiles.stripe_connect_completed` to true. In practice the
 * webhook can be delayed, mis-routed (e.g. pinned to an older Vercel
 * deployment), or temporarily mis-configured, leaving the partner
 * dashboard stuck on "Set up payout account" even after Stripe has
 * accepted the onboarding submission.
 *
 * This helper pulls the live account from Stripe and applies the same
 * completion rule the webhook uses. Safe to call on every dashboard
 * page load — it short-circuits if either:
 *   - the vendor has no `stripe_account_id`, or
 *   - the profile already shows `stripe_connect_completed = true`.
 */
export type ConnectReconcileVendor = {
  id: string
  stripe_account_id: string | null
  stripe_connect_completed: boolean
  location_address?: string | null
}

export type ConnectReconcileResult = {
  stripe_connect_completed: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
}

let cachedStripe: Stripe | null = null
function getStripe(): Stripe | null {
  if (cachedStripe) return cachedStripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  cachedStripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' })
  return cachedStripe
}

export async function reconcileStripeConnectStatus(
  admin: SupabaseClient,
  vendor: ConnectReconcileVendor
): Promise<ConnectReconcileResult | null> {
  if (!vendor.stripe_account_id) return null
  if (vendor.stripe_connect_completed) return null

  const stripe = getStripe()
  if (!stripe) return null

  let account: Stripe.Account
  try {
    account = await stripe.accounts.retrieve(vendor.stripe_account_id)
  } catch (err) {
    console.warn('reconcileStripeConnectStatus: failed to fetch account', err)
    return null
  }

  const detailsSubmitted = Boolean(account.details_submitted)
  const chargesEnabled = Boolean(account.charges_enabled)
  const payoutsEnabled = Boolean(account.payouts_enabled)
  const connectCompleted = detailsSubmitted && chargesEnabled && payoutsEnabled

  if (!connectCompleted) {
    return {
      stripe_connect_completed: false,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
      details_submitted: detailsSubmitted,
    }
  }

  const { error: updateErr } = await admin
    .from('vendor_profiles')
    .update({ stripe_connect_completed: true })
    .eq('id', vendor.id)

  if (updateErr) {
    console.warn('reconcileStripeConnectStatus: failed to update vendor', updateErr)
    return null
  }

  try {
    const { ensureConnectedAccountStripeTaxReady } = await import(
      '@/lib/stripe-vendor-tax-setup'
    )
    await ensureConnectedAccountStripeTaxReady(stripe, account.id, {
      locationAddress: vendor.location_address,
    })
  } catch (taxErr) {
    console.warn('reconcileStripeConnectStatus: tax setup failed', taxErr)
  }

  return {
    stripe_connect_completed: true,
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    details_submitted: detailsSubmitted,
  }
}
