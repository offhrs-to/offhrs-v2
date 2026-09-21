import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/token-encryption'
import { shopifyBillingAllowsSync } from '@/lib/shopify/billing'
import {
  deleteShopifyPendingInstall,
  loadShopifyPendingByShopDomain,
  type ShopifyPendingInstallRow,
} from '@/lib/shopify/pending-install'
import {
  bootstrapOffhrsChannelFeeds,
} from '@/lib/shopify/bootstrap-channel'
import {
  ensureShopifyWebhooks,
  loadShopifyShopForVendor,
  syncShopifyWorkshopsForShop,
  upsertVendorShopifyShop,
} from '@/lib/shopify/sync-workshops'

type Admin = SupabaseClient

/**
 * Attach a pending Shopify OAuth install (tokens already stored) to a vendor.
 * Used after AccountConnection sign-in so merchants don't re-run OAuth.
 */
export async function claimPendingInstallForVendor(opts: {
  admin: Admin
  vendorId: string
  businessName?: string | null
  shopDomain: string
  callbackBaseUrl: string
  pending?: ShopifyPendingInstallRow | null
}): Promise<{ claimed: boolean; reason?: string }> {
  const pending =
    opts.pending ?? (await loadShopifyPendingByShopDomain(opts.admin, opts.shopDomain))
  if (!pending) return { claimed: false, reason: 'no_pending' }

  const { data: existingShop } = await opts.admin
    .from('vendor_shopify_shops')
    .select('vendor_id')
    .eq('shop_domain', pending.shop_domain)
    .maybeSingle()
  if (existingShop && existingShop.vendor_id !== opts.vendorId) {
    await deleteShopifyPendingInstall(opts.admin, pending.id)
    return { claimed: false, reason: 'shop_already_linked' }
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

  await upsertVendorShopifyShop(opts.admin, {
    vendorId: opts.vendorId,
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
    callbackBaseUrl: opts.callbackBaseUrl,
  }).catch((e) => console.error('[shopify] webhook register', e))

  const shopRow = await loadShopifyShopForVendor(opts.admin, opts.vendorId)
  if (shopRow) {
    const billingOk = shopifyBillingAllowsSync({
      billingStatus: shopRow.billing_status,
      shopDomain: shopRow.shop_domain,
    })
    await bootstrapOffhrsChannelFeeds(opts.admin, shopRow, {
      accountName: opts.businessName,
      triggerFullSync: billingOk,
    }).catch((e) => console.error('[shopify] channel bootstrap', e))

    if (billingOk) {
      await syncShopifyWorkshopsForShop(opts.admin, shopRow).catch((e) =>
        console.error('[shopify] initial sync', e)
      )
    }
  }

  await deleteShopifyPendingInstall(opts.admin, pending.id)
  return { claimed: true }
}
