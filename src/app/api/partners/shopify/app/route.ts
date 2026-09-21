import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { signOAuthState } from '@/lib/oauth-state'
import { shopifyOAuthAppBase } from '@/lib/shopify/app-base'
import { shopifyChannelRedirect } from '@/lib/shopify/channel-home'
import {
  normalizeShopDomain,
  shopHasStorefrontTokenScope,
  shopifyApiKey,
  shopifyApiSecret,
  shopifyAuthorizeUrl,
  shopifyOauthScopes,
  verifyShopifyOAuthHmac,
} from '@/lib/shopify/admin-client'
import { loadShopifyShopByDomain } from '@/lib/shopify/sync-workshops'
import { loadShopifyPendingByShopDomain } from '@/lib/shopify/pending-install'

/** Escape Shopify Admin iframe — accounts.shopify.com cannot be framed. */
function topLevelNavigateHtml(url: string): NextResponse {
  const safeJs = JSON.stringify(url)
  const safeHref = url
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Continue to Shopify</title>
<script>
(function () {
  var url = ${safeJs};
  function go() {
    try { if (window.top) { window.top.location.href = url; return true; } } catch (e) {}
    try { if (window.top) { window.top.location.replace(url); return true; } } catch (e) {}
    try { window.open(url, "_top"); return true; } catch (e) {}
    return false;
  }
  go();
  document.addEventListener("DOMContentLoaded", function () {
    var a = document.getElementById("c");
    if (!a) return;
    a.addEventListener("click", function (e) {
      e.preventDefault();
      if (!go()) window.location.href = url;
    });
  });
})();
</script>
</head><body style="font-family:system-ui,sans-serif;padding:24px;text-align:center">
<p>Opening Shopify authorization in the main window…</p>
<p><a id="c" href="${safeHref}" target="_top" rel="noopener">Continue</a></p>
<p style="color:#666;font-size:13px;margin-top:16px">If nothing happens, click Continue (required in some browsers / private windows).</p>
</body></html>`
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // This bounce page may load inside Admin briefly before top navigation.
      'Content-Security-Policy':
        'frame-ancestors https://admin.shopify.com https://*.myshopify.com https://admin.shopify.io;',
    },
  })
}

/**
 * Shopify install / App URL bootstrap (HMAC + OAuth).
 * Embedded App URL is `/shopify`; that page forwards here when hmac is present
 * or when the shop has no offline token yet.
 */
export async function GET(request: NextRequest) {
  const base = shopifyOAuthAppBase(request)
  const clientId = shopifyApiKey()
  const clientSecret = shopifyApiSecret()
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${base}/shopify?shopify_error=not_configured`)
  }

  const params = request.nextUrl.searchParams
  const host = params.get('host')
  if (!verifyShopifyOAuthHmac(params, clientSecret)) {
    return NextResponse.redirect(
      `${base}/shopify?shopify_error=invalid_hmac${host ? `&host=${encodeURIComponent(host)}` : ''}`
    )
  }

  const shop = normalizeShopDomain(params.get('shop'))
  if (!shop) {
    return NextResponse.redirect(`${base}/shopify?shopify_error=missing_shop`)
  }

  // Already installed + linked: skip OAuth unless scopes need upgrading or force_reauth.
  // Pending install (OAuth done, partner not linked yet): show Admin UI — Connect via AccountConnection.
  const forceReauth = params.get('force_reauth') === '1'
  const admin = createAdminClient()
  if (admin && !forceReauth) {
    const existing = await loadShopifyShopByDomain(admin, shop)
    if (existing && shopHasStorefrontTokenScope(existing.scope)) {
      return shopifyChannelRedirect(request, { shop, host })
    }
    const pending = await loadShopifyPendingByShopDomain(admin, shop)
    if (pending) {
      return shopifyChannelRedirect(request, { shop, host, query: 'shopify_installed=1' })
    }
  }

  let vendorId: string | undefined
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user && admin) {
      const { data: vendor } = await admin
        .from('vendor_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (vendor?.id) vendorId = vendor.id
    }
  } catch {
    // Ignore session lookup failures — still start OAuth.
  }

  const redirectUri = `${base}/api/partners/shopify/callback`
  const state = signOAuthState({
    ...(vendorId ? { vendorId } : {}),
    ...(host ? { host } : {}),
    provider: 'shopify',
    shop,
    exp: Date.now() + 15 * 60 * 1000,
  })

  const url = shopifyAuthorizeUrl({
    shop,
    clientId,
    scopes: shopifyOauthScopes(),
    redirectUri,
    state,
  })
  // Must leave the Admin iframe — Shopify accounts login blocks framing.
  return topLevelNavigateHtml(url)
}
