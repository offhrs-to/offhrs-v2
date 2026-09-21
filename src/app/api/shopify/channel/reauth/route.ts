import { NextRequest, NextResponse } from 'next/server'
import { signOAuthState } from '@/lib/oauth-state'
import { shopifyOAuthAppBase } from '@/lib/shopify/app-base'
import { requireLinkedChannelShop } from '@/lib/shopify/require-linked-channel'
import {
  normalizeShopDomain,
  shopifyApiKey,
  shopifyAuthorizeUrl,
  shopifyOauthScopes,
} from '@/lib/shopify/admin-client'

/**
 * Start OAuth with the current scope list (scope upgrade for existing installs).
 * Used when Shopify does not auto-prompt after toml scope changes.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { shop?: string; host?: string }
  const shop = normalizeShopDomain(body.shop)
  if (!shop) {
    return NextResponse.json({ error: 'Missing shop' }, { status: 400 })
  }

  const clientId = shopifyApiKey()
  if (!clientId) {
    return NextResponse.json({ error: 'Shopify not configured' }, { status: 500 })
  }

  const ctx = await requireLinkedChannelShop(request, shop)
  if (ctx instanceof NextResponse) return ctx
  const { vendor } = ctx

  const base = shopifyOAuthAppBase(request)
  const host = typeof body.host === 'string' ? body.host : undefined
  const redirectUri = `${base}/api/partners/shopify/callback`
  const state = signOAuthState({
    vendorId: vendor.id,
    ...(host ? { host } : {}),
    provider: 'shopify',
    shop,
    exp: Date.now() + 15 * 60 * 1000,
  })

  const authorizeUrl = shopifyAuthorizeUrl({
    shop,
    clientId,
    scopes: shopifyOauthScopes(),
    redirectUri,
    state,
  })

  return NextResponse.json({ authorizeUrl, scopes: shopifyOauthScopes() })
}
