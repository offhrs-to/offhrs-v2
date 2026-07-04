import 'server-only'

/**
 * In-memory cache for /api/book/quote tax previews.
 *
 * Stripe Tax bills ~$0.05 per `tax.calculations.create`. The mobile and web
 * quick-view modals call `/api/book/quote` every time they open, which means
 * the same `(event_id, postal_code, state)` combination can be re-priced many
 * times in a single user session. Those repeat calls produce identical results
 * (vendor price and CRA tax rules do not change minute-to-minute) but each one
 * still costs the platform a Stripe Tax API call.
 *
 * This cache memoizes the preview response per server instance so repeat
 * opens of the same workshop by the same (or another) user reuse the previous
 * result for the TTL window.
 *
 * Important caveats:
 *   - The cached value is *only* the consumer-facing preview (subtotal/tax/total
 *     + refund policy). The Stripe Tax `calculationId` is NOT cached and is
 *     never reused for `/api/book` PaymentIntent creation — the real booking
 *     path always creates a fresh calculation so the eventual
 *     `tax.transactions.createFromCalculation` is bound to a brand-new
 *     calculation. This keeps reconciliation 1:1 with Stripe.
 *   - The cache is per-Vercel-instance. Cold starts clear it; warm instances
 *     reuse it. Even at modest hit rates this materially reduces Tax API spend
 *     during heavy modal browsing.
 *   - Free events (price <= 0) are not stored because they never hit Stripe Tax.
 */

export type CachedTaxQuote = {
  subtotalCad: number
  taxCad: number
  totalCad: number
  refundWindowHours: number | null
  refundPolicyLine: string
  strictNoRefund: boolean
}

type CacheEntry = {
  value: CachedTaxQuote
  /** Epoch millis when this entry expires and must be re-fetched. */
  expiresAt: number
}

/** 10 minutes. Long enough to cover repeat modal opens in a session; short
 *  enough that vendor price edits or refund-window changes propagate quickly. */
const DEFAULT_TTL_MS = 10 * 60 * 1000

/** Hard ceiling so a runaway dev session can't grow the map unbounded. */
const MAX_ENTRIES = 5_000

const cache = new Map<string, CacheEntry>()

function buildKey(eventId: number | string, postalCode: string, state: string): string {
  const normPostal = String(postalCode).trim().toUpperCase().replace(/\s+/g, '')
  const normState = String(state).trim().toUpperCase()
  return `${String(eventId)}|${normPostal}|${normState}`
}

function evictIfFull(): void {
  if (cache.size < MAX_ENTRIES) return
  // Drop the oldest 10% of entries (insertion order is preserved in Map).
  const dropCount = Math.ceil(MAX_ENTRIES * 0.1)
  let dropped = 0
  for (const key of cache.keys()) {
    if (dropped >= dropCount) break
    cache.delete(key)
    dropped += 1
  }
}

export function getCachedTaxQuote(
  eventId: number | string,
  postalCode: string,
  state: string
): CachedTaxQuote | null {
  const key = buildKey(eventId, postalCode, state)
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.value
}

export function setCachedTaxQuote(
  eventId: number | string,
  postalCode: string,
  state: string,
  value: CachedTaxQuote,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  evictIfFull()
  const key = buildKey(eventId, postalCode, state)
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
}

/** Drop any cached entries for this event id — call after vendor edits price. */
export function invalidateCachedTaxQuotesForEvent(eventId: number | string): void {
  const prefix = `${String(eventId)}|`
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

/** Test/diagnostic only — clears all cached entries. */
export function __clearTaxQuoteCacheForTesting(): void {
  cache.clear()
}
