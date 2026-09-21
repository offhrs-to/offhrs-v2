import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ensureOffhrsChannelConnection,
  triggerOffhrsChannelFullSync,
} from '@/lib/shopify/channel-connection'
import { ensureStorefrontAccessToken } from '@/lib/shopify/cart-permalink'
import {
  getValidShopAccessToken,
  type ShopifyShopRow,
} from '@/lib/shopify/sync-workshops'

type Admin = SupabaseClient

/**
 * After partner↔shop link (and when billing unlocks): create channel + kick feed sync.
 * Safe to call repeatedly. Failures are logged — tag-based sync remains a fallback.
 */
export async function bootstrapOffhrsChannelFeeds(
  admin: Admin,
  shopRow: ShopifyShopRow,
  opts?: { accountName?: string | null; triggerFullSync?: boolean }
): Promise<void> {
  const accountName =
    opts?.accountName?.trim() ||
    shopRow.shop_domain.replace(/\.myshopify\.com$/i, '') ||
    'offhrs partner'

  const created = await ensureOffhrsChannelConnection(admin, shopRow, {
    accountId: shopRow.vendor_id,
    accountName,
  })

  if (!created.channelGid) {
    console.error('[shopify] channel bootstrap skipped:', created.error)
    throw new Error(created.error || 'channelCreate failed')
  }

  // Already bootstrapped — skip token / feed work on repeat Sync clicks.
  const alreadyReady =
    Boolean(shopRow.shopify_channel_gid) && Boolean(shopRow.storefront_access_token_encrypted)
  if (alreadyReady && opts?.triggerFullSync === false) {
    return
  }

  // Reload row so channel GID is present for full sync / storefront token.
  const { data: fresh } = await admin
    .from('vendor_shopify_shops')
    .select(
      'id, vendor_id, shop_domain, access_token_encrypted, refresh_token_encrypted, access_token_expires_at, refresh_token_expires_at, sync_enabled, billing_status, app_subscription_gid, scope, shopify_channel_gid, shopify_channel_handle, storefront_access_token_encrypted'
    )
    .eq('id', shopRow.id)
    .maybeSingle()

  const row = (fresh as ShopifyShopRow | null) ?? {
    ...shopRow,
    shopify_channel_gid: created.channelGid,
    shopify_channel_handle: created.handle,
  }

  if (!row.storefront_access_token_encrypted) {
    try {
      const adminToken = await getValidShopAccessToken(admin, row)
      await ensureStorefrontAccessToken(admin, row, adminToken)
    } catch (err) {
      console.error(
        '[shopify] storefront token bootstrap',
        err instanceof Error ? err.message : err
      )
    }
  }

  if (opts?.triggerFullSync !== false) {
    const sync = await triggerOffhrsChannelFullSync(admin, row)
    if (!sync.ok) {
      console.error('[shopify] channelFullSync', sync.error)
    }
  }
}
