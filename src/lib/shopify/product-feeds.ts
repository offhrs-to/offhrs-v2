import type { SupabaseClient } from '@supabase/supabase-js'
import { shopifyGidToNumericId } from '@/lib/shopify/admin-client'
import {
  archiveShopifyProductEvents,
  syncShopifyProductByNumericId,
  type ShopifyShopRow,
} from '@/lib/shopify/sync-workshops'

type Admin = SupabaseClient

type FeedPayload = {
  metadata?: {
    action?: string
    type?: string
    resource?: string
  }
  product?: {
    id?: string
    isPublished?: boolean
  }
  productFeed?: {
    id?: string
    country?: string
    language?: string
    status?: string
  }
  fullSync?: {
    status?: string
    count?: number
  }
}

/**
 * Handle Contextual Product Feed webhooks (full + incremental).
 * Refetches the product via Admin GraphQL so offhrs metafields resolve.
 */
export async function processProductFeedWebhook(
  admin: Admin,
  shopRow: ShopifyShopRow,
  topic: string,
  payload: Record<string, unknown>
): Promise<{ handled: boolean; detail?: string }> {
  if (topic === 'product_feeds/update') {
    // Feed status changes (e.g. inactive language) — log only for Phase 2.
    console.info('[shopify] product_feeds/update', {
      shop: shopRow.shop_domain,
      feed: payload.id ?? (payload as FeedPayload).productFeed?.id,
      status: payload.status ?? (payload as FeedPayload).productFeed?.status,
    })
    return { handled: true, detail: 'feed_status' }
  }

  if (topic === 'product_feeds/full_sync_finish') {
    const full = (payload as FeedPayload).fullSync
    console.info('[shopify] product_feeds/full_sync_finish', {
      shop: shopRow.shop_domain,
      status: full?.status,
      count: full?.count,
    })
    await admin
      .from('vendor_shopify_shops')
      .update({
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', shopRow.id)
    return { handled: true, detail: 'full_sync_finish' }
  }

  if (topic !== 'product_feeds/full_sync' && topic !== 'product_feeds/incremental_sync') {
    return { handled: false }
  }

  const feed = payload as FeedPayload
  const productRaw = (feed.product ??
    payload.product ??
    (payload as { Product?: FeedPayload['product'] }).Product) as FeedPayload['product'] | undefined
  const productGid = productRaw?.id
  if (!productGid || typeof productGid !== 'string') {
    console.warn('[shopify] product feed missing product.id', {
      shop: shopRow.shop_domain,
      topic,
      keys: Object.keys(payload),
    })
    return { handled: true, detail: 'no_product' }
  }

  const productNumericId = shopifyGidToNumericId(productGid)
  if (!productNumericId) {
    return { handled: true, detail: 'bad_product_id' }
  }

  const action = (feed.metadata?.action ?? '').toUpperCase()
  const unpublished = productRaw?.isPublished === false || action === 'DELETE'

  if (unpublished) {
    const archived = await archiveShopifyProductEvents(
      admin,
      shopRow.vendor_id,
      productNumericId
    )
    console.info('[shopify] product feed unpublished', {
      shop: shopRow.shop_domain,
      productNumericId,
      archived,
    })
    return { handled: true, detail: `unpublished:${archived}` }
  }

  const result = await syncShopifyProductByNumericId(admin, shopRow, productNumericId, {
    requireWorkshopTag: false,
    submitFeedback: true,
  })

  console.info('[shopify] product feed sync', {
    shop: shopRow.shop_domain,
    topic,
    productNumericId,
    upserted: result.upserted,
    skipped: result.skipped,
    archived: result.archived,
  })

  return {
    handled: true,
    detail: `sync:upserted=${result.upserted};skipped=${result.skipped};archived=${result.archived}`,
  }
}
