import { createHmac, timingSafeEqual } from 'crypto'
import {
  normalizeShopDomain,
  shopifyApiKey,
  shopifyApiSecret,
} from '@/lib/shopify/admin-client'

export type ShopifySessionTokenPayload = {
  iss: string
  dest: string
  aud: string
  sub: string
  exp: number
  nbf: number
  iat?: number
  sid?: string
  shop: string
}

/** App Bridge often mints tokens with slight clock skew (Shopify libs use ~10s). */
const TIME_LEEWAY_SEC = 15

function b64urlJson(part: string): unknown {
  const padded = part.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return JSON.parse(Buffer.from(padded + pad, 'base64').toString('utf8'))
}

function b64urlToBuffer(part: string): Buffer {
  const padded = part.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return Buffer.from(padded + pad, 'base64')
}

/**
 * Verify a Shopify Admin ID token (session token) from App Bridge.
 * https://shopify.dev/docs/apps/build/authentication-authorization/id-tokens
 */
export function verifyShopifySessionToken(
  token: string,
  opts?: { expectedShop?: string | null }
): ShopifySessionTokenPayload | null {
  const apiKey = shopifyApiKey()
  const apiSecret = shopifyApiSecret()
  if (!apiKey || !apiSecret || !token.trim()) return null

  const parts = token.trim().split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, sigB64] = parts
  if (!headerB64 || !payloadB64 || !sigB64) return null

  let header: { alg?: string; typ?: string }
  try {
    header = b64urlJson(headerB64) as { alg?: string; typ?: string }
  } catch {
    return null
  }
  if ((header.alg ?? '').toUpperCase() !== 'HS256') return null

  const expectedSig = createHmac('sha256', apiSecret)
    .update(`${headerB64}.${payloadB64}`)
    .digest()
  const actualSig = b64urlToBuffer(sigB64)
  if (expectedSig.length !== actualSig.length || !timingSafeEqual(expectedSig, actualSig)) {
    return null
  }

  let payload: Record<string, unknown>
  try {
    payload = b64urlJson(payloadB64) as Record<string, unknown>
  } catch {
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  const exp = Number(payload.exp)
  const nbf = Number(payload.nbf)
  if (!Number.isFinite(exp) || exp + TIME_LEEWAY_SEC < now) return null
  if (!Number.isFinite(nbf) || nbf > now + TIME_LEEWAY_SEC) return null

  const audRaw = payload.aud
  const aud = Array.isArray(audRaw) ? String(audRaw[0] ?? '') : String(audRaw ?? '')
  if (aud !== apiKey) return null

  const iss = String(payload.iss ?? '')
  const dest = String(payload.dest ?? '')
  let destHost: string
  let issHost: string
  try {
    destHost = new URL(dest.includes('://') ? dest : `https://${dest}`).hostname.toLowerCase()
    issHost = new URL(iss.includes('://') ? iss : `https://${iss}`).hostname.toLowerCase()
  } catch {
    return null
  }

  const shop = normalizeShopDomain(destHost)
  if (!shop) return null

  // Shopify docs: iss/dest hostnames must match. Also allow admin.shopify.com issuer.
  if (issHost !== destHost && issHost !== 'admin.shopify.com') {
    return null
  }

  const expected = normalizeShopDomain(opts?.expectedShop ?? null)
  if (expected && expected !== shop) return null

  return {
    iss,
    dest,
    aud,
    sub: String(payload.sub ?? ''),
    exp,
    nbf,
    iat: typeof payload.iat === 'number' ? payload.iat : undefined,
    sid: typeof payload.sid === 'string' ? payload.sid : undefined,
    shop,
  }
}

/** Read Shopify ID token from Authorization Bearer or X-Shopify-Session-Token. */
export function extractShopifySessionToken(request: {
  headers: { get(name: string): string | null }
}): string | null {
  const dedicated = request.headers.get('x-shopify-session-token')?.trim()
  if (dedicated) return dedicated

  const auth = request.headers.get('authorization')
  if (!auth?.toLowerCase().startsWith('bearer ')) return null
  const token = auth.slice(7).trim()
  return token || null
}
