import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

/**
 * Returns an existing Stripe Customer id for the profile, or creates one and persists it.
 * Uses the service-role Supabase client (bypasses RLS).
 *
 * If the stored id belongs to a different Stripe mode/account (common when Preview
 * shares Production Supabase but uses test keys), creates a new customer.
 */
export async function getOrCreateStripeCustomerId(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string,
  email: string | undefined
): Promise<string> {
  const { data: row, error: selErr } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()

  if (selErr) {
    console.error('getOrCreateStripeCustomerId select:', selErr)
  }

  const existing = row?.stripe_customer_id as string | null | undefined
  if (existing && existing.startsWith('cus_')) {
    try {
      const retrieved = await stripe.customers.retrieve(existing)
      if (!('deleted' in retrieved && retrieved.deleted)) {
        return existing
      }
    } catch (err) {
      console.warn(
        'getOrCreateStripeCustomerId: stored customer not usable on this Stripe account; creating a new one',
        existing,
        err instanceof Error ? err.message : err
      )
    }
  }

  const customer = await stripe.customers.create({
    email: email?.trim() || undefined,
    metadata: { supabase_user_id: userId },
  })

  const { error: upErr } = await admin
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)

  if (upErr) {
    console.error('getOrCreateStripeCustomerId update:', upErr)
    // Still return the customer — PI can proceed; profile sync can retry later.
    console.warn('getOrCreateStripeCustomerId: proceeding without persisting customer id')
  }

  return customer.id
}
