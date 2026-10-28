/**
 * Temporary App Store review lock: partner signup offers Shopify Sync only
 * (Shopify Billing). Lite / Pro / Marketplace stay hidden until Sync is approved.
 *
 * Restore after approval (either works):
 * 1. Set NEXT_PUBLIC_PARTNER_SIGNUP_SHOPIFY_SYNC_ONLY=0 in Vercel (Production + Preview), redeploy
 * 2. Or change the default below to `false` and deploy
 */
export function isPartnerSignupShopifySyncOnly(): boolean {
  const raw = process.env.NEXT_PUBLIC_PARTNER_SIGNUP_SHOPIFY_SYNC_ONLY?.trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  if (raw === '1' || raw === 'true' || raw === 'on') return true
  // Default ON until Shopify Sync App Store approval — flip off with env or this default.
  return true
}
