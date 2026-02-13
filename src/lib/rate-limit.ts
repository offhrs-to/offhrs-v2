/**
 * In-memory rate limiter (per deployment instance).
 * For multi-instance/serverless, consider Vercel KV or Redis.
 */

const WINDOW_MS = 60 * 1000 // 1 minute
const MAX_ENTRIES = 10_000

type Entry = { count: number; resetAt: number }

const store = new Map<string, Entry>()

function evictExpired(): void {
  const now = Date.now()
  if (store.size <= MAX_ENTRIES) return
  for (const [key, entry] of store.entries()) {
    if (now >= entry.resetAt) store.delete(key)
  }
}

/**
 * Returns true if the request is allowed, false if rate limited.
 * @param key Identifier (e.g. IP or user id)
 * @param limit Max requests per window
 */
export function rateLimit(key: string, limit: number): boolean {
  const now = Date.now()
  if (store.size > MAX_ENTRIES) evictExpired()

  let entry = store.get(key)
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS }
    store.set(key, entry)
  }
  entry.count += 1
  return entry.count <= limit
}

/** Get client identifier from request (IP or x-forwarded-for). */
export function getRateLimitKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0]?.trim() : null
  return ip ?? request.headers.get('x-real-ip') ?? 'unknown'
}
