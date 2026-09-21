/**
 * Shop domain helpers safe for both server and browser bundles.
 */

/** Normalize to `store.myshopify.com` (lowercase). Returns null if invalid. */
export function normalizeShopDomain(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  let shop = raw.trim().toLowerCase()
  shop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (shop.includes('/')) shop = shop.split('/')[0] ?? shop
  if (!shop.includes('.')) shop = `${shop}.myshopify.com`
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) return null
  return shop
}

/**
 * Decode Shopify Admin `host` query (base64 of `shop.myshopify.com/admin`).
 * Admin often opens the app with `host` but without `shop`.
 */
export function shopDomainFromHostParam(host: string | null | undefined): string | null {
  if (!host?.trim()) return null
  try {
    const normalized = host.trim().replace(/-/g, '+').replace(/_/g, '/')
    const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
    const b64 = normalized + pad
    let decoded: string
    if (typeof atob === 'function') {
      decoded = atob(b64)
    } else {
      decoded = Buffer.from(b64, 'base64').toString('utf8')
    }
    const hostname = decoded.split('/')[0]?.trim() ?? ''
    return normalizeShopDomain(hostname)
  } catch {
    return null
  }
}
