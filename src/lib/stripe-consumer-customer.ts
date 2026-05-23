import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

/**
 * Returns an existing Stripe Customer id for the profile, or creates one and persists it.
 * Uses the service-role Supabase client (bypasses RLS).
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
    return existing
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
    throw new Error('Could not save payment profile')
  }

  return customer.id
}
