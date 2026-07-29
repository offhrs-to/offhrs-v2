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
 * @param windowMs Window length (default 1 minute)
 */
export function rateLimit(key: string, limit: number, windowMs: number = WINDOW_MS): boolean {
  return consumeRateLimit(key, limit, windowMs).allowed
}

export type RateLimitResult = {
  allowed: boolean
  retryAfterSeconds: number
  remaining: number
}

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number = WINDOW_MS
): RateLimitResult {
  const now = Date.now()
  if (store.size > MAX_ENTRIES) evictExpired()

  let entry = store.get(key)
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs }
    store.set(key, entry)
  }
  entry.count += 1
  const remaining = Math.max(0, limit - entry.count)
  return {
    allowed: entry.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    remaining,
  }
}

/**
 * Get client identifier for rate limiting (IP from x-forwarded-for / x-real-ip).
 * Optionally append userId for per-user limits when authenticated (IP + user-based).
 */
export function getRateLimitKey(request: Request, userId?: string | null): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0]?.trim() : null
  const base = ip ?? request.headers.get('x-real-ip') ?? 'unknown'
  if (userId != null && userId !== '') return `${base}:${userId}`
  return base
}

