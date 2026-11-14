import 'server-only'

import type Stripe from 'stripe'
import { getStripeFullPriceId, getStripeLitePriceId, getStripeProPriceId } from '@/lib/stripe-partner-plans'

/**
 * Ensure the Customer Portal lists current Lite/Pro (and Full if configured)
 * prices for plan switching. Dashboard portal config often still points at the
 * old $49 Pro price after migrating to $39 — then Pro disappears from "Update
 * your subscription".
 */
export async function ensurePartnerBillingPortalConfiguration(
  stripe: Stripe
): Promise<string | null> {
  const priceIds = [getStripeLitePriceId(), getStripeProPriceId(), getStripeFullPriceId()].filter(
    Boolean
  )
  if (priceIds.length < 2) {
    console.warn(
      'Partner billing portal: need at least Lite + Pro price IDs in env; using Stripe default portal config'
    )
    return null
  }

  const productToPrices = new Map<string, string[]>()
  for (const priceId of priceIds) {
    const price = await stripe.prices.retrieve(priceId)
    const productId = typeof price.product === 'string' ? price.product : price.product.id
    const list = productToPrices.get(productId) ?? []
    if (!list.includes(priceId)) list.push(priceId)
    productToPrices.set(productId, list)
  }

  const products = [...productToPrices.entries()].map(([product, prices]) => ({
    product,
    prices,
  }))

  const desiredKey = products
    .map((p) => `${p.product}:${[...p.prices].sort().join(',')}`)
    .sort()
    .join('|')

  const existing = await stripe.billingPortal.configurations.list({ limit: 20, active: true })
  const match = existing.data.find((c) => c.metadata?.offhrs_plans_key === desiredKey)
  if (match) return match.id

  const created = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: 'offhrs partners with Stripe for simplified billing.',
    },
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ['email', 'address', 'tax_id'],
      },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        products,
      },
    },
    metadata: {
      offhrs_plans_key: desiredKey,
      purpose: 'partner_lite_pro_switch',
    },
  })

  return created.id
}
