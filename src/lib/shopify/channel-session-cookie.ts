import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  normalizeShopDomain,
  shopifyApiSecret,
} from '@/lib/shopify/admin-client'
import { verifyShopifySessionToken } from '@/lib/shopify/session-token'

export const CHANNEL_SHOP_COOKIE = 'offhrs_channel_shop'
/** Keep merchant "connected" across Admin navigations without re-fetching App Bridge. */
const MAX_AGE_SEC = 60 * 60 * 24 * 7

function sign(shop: string, exp: number, secret: string): string {
  return createHmac('sha256', secret).update(`${shop}|${exp}`).digest('base64url')
}

function cookieHeader(value: string, maxAge: number): string {
  // Explicit Partitioned — required for Firefox CHIPS inside Admin iframe.
  return [
    `${CHANNEL_SHOP_COOKIE}=${value}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'Secure',
    'HttpOnly',
    'SameSite=None',
    'Partitioned',
  ].join('; ')
}

export function buildChannelShopCookieValue(shop: string): string | null {
  const secret = shopifyApiSecret()
  const normalized = normalizeShopDomain(shop)
  if (!secret || !normalized) return null
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC
  return `${encodeURIComponent(normalized)}.${exp}.${sign(normalized, exp, secret)}`
}

export function readChannelShopCookie(request: NextRequest): string | null {
  const raw = request.cookies.get(CHANNEL_SHOP_COOKIE)?.value
  if (!raw) return null
  const secret = shopifyApiSecret()
  if (!secret) return null

  const parts = raw.split('.')
  if (parts.length !== 3) return null
  const [shopPart, expPart, sig] = parts
  const shop = normalizeShopDomain(decodeURIComponent(shopPart ?? ''))
  const exp = Number(expPart)
  if (!shop || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null

  const expected = sign(shop, exp, secret)
  const a = Buffer.from(expected)
  const b = Buffer.from(sig ?? '')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return shop
}

export function setChannelShopCookie(response: NextResponse, shop: string): void {
  const value = buildChannelShopCookieValue(shop)
  if (!value) return
  response.headers.append('Set-Cookie', cookieHeader(value, MAX_AGE_SEC))
}

export function clearChannelShopCookie(response: NextResponse): void {
  response.headers.append('Set-Cookie', cookieHeader('', 0))
}

/**
 * Mint the channel cookie on the HTML document response (correct iframe partition).
 * Call from the /shopify Server Component when Shopify provides id_token.
 */
export async function mintChannelShopCookieFromIdToken(opts: {
  idToken: string
  shop: string
}): Promise<boolean> {
  const session = verifyShopifySessionToken(opts.idToken, { expectedShop: opts.shop })
  if (!session) return false
  const value = buildChannelShopCookieValue(session.shop)
  if (!value) return false

  const jar = await cookies()
  jar.set({
    name: CHANNEL_SHOP_COOKIE,
    value,
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: MAX_AGE_SEC,
    partitioned: true,
  })
  return true
}
