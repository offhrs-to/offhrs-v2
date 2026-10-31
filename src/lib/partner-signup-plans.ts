/**
 * Temporary App Store review lock (until Shopify Sync is approved).
 *
 * When ON, hides Stripe Lite / Pro / Marketplace from:
 * - Partner signup plan picker
 * - /partners marketing CTAs
 * - Sync-only dashboard upsells (Marketplace + View plans)
 * - Settings → Lite & Pro (optional)
 * And blocks Stripe checkout + Marketplace enroll APIs.
 *
 * RESTORE AFTER SHOPIFY APPROVAL:
 * 1. Vercel → offhrs-v2 → Environment Variables
 * 2. Set NEXT_PUBLIC_PARTNER_SIGNUP_SHOPIFY_SYNC_ONLY=0 (Production + Preview)
 * 3. Redeploy production
 * Or change the default below to `false` and deploy.
 *
 * Reminder checklist: docs/AFTER_SHOPIFY_SYNC_APPROVAL.md
 */
export function isPartnerSignupShopifySyncOnly(): boolean {
  const raw = process.env.NEXT_PUBLIC_PARTNER_SIGNUP_SHOPIFY_SYNC_ONLY?.trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  if (raw === '1' || raw === 'true' || raw === 'on') return true
  // Default ON until Shopify Sync App Store approval — flip off with env or this default.
  return true
}
