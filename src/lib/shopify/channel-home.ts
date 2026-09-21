import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { shopifyOAuthAppBase } from '@/lib/shopify/app-base'
import { normalizeShopDomain } from '@/lib/shopify/admin-client'

/** Post-OAuth / billing landing for the embedded sales channel Admin UI. */
export function shopifyChannelHomeUrl(
  request: NextRequest,
  opts: { shop: string; host?: string | null; query?: string }
): string {
  const base = shopifyOAuthAppBase(request)
  const params = new URLSearchParams()
  const shop = normalizeShopDomain(opts.shop) ?? opts.shop
  params.set('shop', shop)
  if (opts.host) params.set('host', opts.host)
  if (opts.query) {
    const extra = new URLSearchParams(opts.query.startsWith('?') ? opts.query.slice(1) : opts.query)
    extra.forEach((v, k) => {
      if (!params.has(k)) params.set(k, v)
    })
  }
  return `${base}/shopify?${params.toString()}`
}

/** Popup closer after AccountConnection OAuth / claim. */
export function shopifyPopupDoneUrl(
  request: NextRequest,
  opts: { shop: string; host?: string | null; query?: string }
): string {
  const base = shopifyOAuthAppBase(request)
  const params = new URLSearchParams()
  const shop = normalizeShopDomain(opts.shop) ?? opts.shop
  params.set('shop', shop)
  if (opts.host) params.set('host', opts.host)
  if (opts.query) {
    const extra = new URLSearchParams(opts.query.startsWith('?') ? opts.query.slice(1) : opts.query)
    extra.forEach((v, k) => {
      if (!params.has(k)) params.set(k, v)
    })
  }
  return `${base}/shopify/popup-done?${params.toString()}`
}

export function shopifyChannelRedirect(
  request: NextRequest,
  opts: { shop: string; host?: string | null; query?: string; popup?: boolean }
): NextResponse {
  if (opts.popup) {
    return NextResponse.redirect(shopifyPopupDoneUrl(request, opts))
  }
  return NextResponse.redirect(shopifyChannelHomeUrl(request, opts))
}

/** Deep link back into the embedded app inside Shopify Admin (top-level). */
export function shopifyAdminEmbeddedAppUrl(shopDomain: string, apiKey: string): string {
  const handle = shopDomain.replace(/\.myshopify\.com$/i, '')
  return `https://admin.shopify.com/store/${handle}/apps/${apiKey}`
}

/**
 * After Shopify OAuth, always land in Admin (requirement 2.3.3).
 * AccountConnection / partner login happens inside the embedded UI, not as the post-auth redirect.
 */
export function redirectToShopifyAdminApp(
  request: NextRequest,
  opts: { shop: string; host?: string | null; query?: string; popup?: boolean; apiKey?: string | null }
): NextResponse {
  if (opts.popup) {
    return NextResponse.redirect(shopifyPopupDoneUrl(request, opts))
  }
  const apiKey = opts.apiKey
  if (apiKey) {
    return NextResponse.redirect(shopifyAdminEmbeddedAppUrl(opts.shop, apiKey))
  }
  return NextResponse.redirect(shopifyChannelHomeUrl(request, opts))
}
