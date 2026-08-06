import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/token-encryption'
import { shopifyOAuthAppBase } from '@/lib/shopify/app-base'
import {
  deleteShopifyPendingInstall,
  loadShopifyPendingByClaimToken,
} from '@/lib/shopify/pending-install'
import {
  ensureShopifyWebhooks,
  loadShopifyShopForVendor,
  syncShopifyWorkshopsForShop,
  upsertVendorShopifyShop,
} from '@/lib/shopify/sync-workshops'

function settingsRedirect(base: string, query: string): NextResponse {
  return NextResponse.redirect(`${base}/partners/dashboard/settings?${query}`)
}

/**
 * Attach a pending Shopify install (tokens from OAuth-before-login) to the
 * signed-in partner vendor.
 */
export async function GET(request: NextRequest) {
  const base = shopifyOAuthAppBase(request)
  const claimToken = request.nextUrl.searchParams.get('token')?.trim()
  if (!claimToken) {
    return settingsRedirect(base, 'shopify_error=missing_claim')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const login = new URL(`${base}/partners/login`)
    login.searchParams.set(
      'next',
      `/api/partners/shopify/claim?token=${encodeURIComponent(claimToken)}`
    )
    return NextResponse.redirect(login.toString())
  }

  const admin = createAdminClient()
  if (!admin) return settingsRedirect(base, 'shopify_error=server')

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!vendor) {
    return settingsRedirect(base, 'shopify_error=vendor_required')
  }

  try {
    const pending = await loadShopifyPendingByClaimToken(admin, claimToken)
    if (!pending) {
      return settingsRedirect(base, 'shopify_error=claim_expired')
    }

    const { data: existingShop } = await admin
      .from('vendor_shopify_shops')
      .select('vendor_id')
      .eq('shop_domain', pending.shop_domain)
      .maybeSingle()
    if (existingShop && existingShop.vendor_id !== vendor.id) {
      await deleteShopifyPendingInstall(admin, pending.id)
      return settingsRedirect(base, 'shopify_error=shop_already_linked')
    }

    const accessToken = decrypt(pending.access_token_encrypted)
    const refreshToken = pending.refresh_token_encrypted
      ? decrypt(pending.refresh_token_encrypted)
      : undefined

    const accessExpiresMs = pending.access_token_expires_at
      ? new Date(pending.access_token_expires_at).getTime() - Date.now()
      : undefined
    const refreshExpiresMs = pending.refresh_token_expires_at
      ? new Date(pending.refresh_token_expires_at).getTime() - Date.now()
      : undefined

    await upsertVendorShopifyShop(admin, {
      vendorId: vendor.id,
      shopDomain: pending.shop_domain,
      accessToken,
      scope: pending.scope ?? '',
      expiresIn:
        typeof accessExpiresMs === 'number' && accessExpiresMs > 0
          ? Math.floor(accessExpiresMs / 1000)
          : undefined,
      refreshToken,
      refreshTokenExpiresIn:
        typeof refreshExpiresMs === 'number' && refreshExpiresMs > 0
          ? Math.floor(refreshExpiresMs / 1000)
          : undefined,
    })

    await ensureShopifyWebhooks({
      shop: pending.shop_domain,
      accessToken,
      callbackBaseUrl: base,
    }).catch((e) => console.error('[shopify] webhook register', e))

    const shopRow = await loadShopifyShopForVendor(admin, vendor.id)
    if (shopRow) {
      await syncShopifyWorkshopsForShop(admin, shopRow).catch((e) =>
        console.error('[shopify] initial sync', e)
      )
    }

    await deleteShopifyPendingInstall(admin, pending.id)
    return settingsRedirect(base, 'shopify_connected=1')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'claim_failed'
    console.error('[shopify] claim', e)
    return settingsRedirect(base, `shopify_error=${encodeURIComponent(msg.slice(0, 120))}`)
  }
}
