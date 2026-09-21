import type { SupabaseClient } from '@supabase/supabase-js'
import { shopifyAdminGraphql } from '@/lib/shopify/admin-client'
import { OFFHRS_CHANNEL_SPEC_HANDLE } from '@/lib/shopify/conventions'
import {
  getValidShopAccessToken,
  type ShopifyShopRow,
} from '@/lib/shopify/sync-workshops'

type Admin = SupabaseClient

const CHANNEL_CREATE = `
  mutation OffhrsChannelCreate($input: ChannelCreateInput!) {
    channelCreate(input: $input) {
      channel { id handle }
      userErrors { field message code }
    }
  }
`

const CHANNEL_BY_HANDLE = `
  query OffhrsChannelByHandle($handle: String!) {
    channelByHandle(handle: $handle) {
      id
      handle
    }
  }
`

const CHANNELS_QUERY = `
  query OffhrsChannels {
    channels(first: 25) {
      nodes {
        id
        handle
        name
      }
    }
  }
`

const CHANNEL_DELETE = `
  mutation OffhrsChannelDelete($id: ID!) {
    channelDelete(id: $id) {
      deletedId
      userErrors { field message }
    }
  }
`

const CHANNEL_FULL_SYNC = `
  mutation OffhrsChannelFullSync($channelId: ID!) {
    channelFullSync(channelId: $channelId) {
      fullSyncTraceInfo { country language operationId }
      userErrors { message }
    }
  }
`

function channelHandleForVendor(vendorId: string): string {
  return `offhrs-ca-${vendorId.replace(/-/g, '').slice(0, 24)}`
}

async function persistChannel(
  admin: Admin,
  shopId: string,
  channel: { id: string; handle: string }
): Promise<void> {
  const { error } = await admin
    .from('vendor_shopify_shops')
    .update({
      shopify_channel_gid: channel.id,
      shopify_channel_handle: channel.handle,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shopId)
  if (error) throw new Error(`persist channel failed: ${error.message}`)
}

/**
 * Create (or re-bind) the offhrs-ca channel connection after partner account link.
 * Idempotent: reuses an existing channel for this account/spec when present.
 */
export async function ensureOffhrsChannelConnection(
  admin: Admin,
  shopRow: ShopifyShopRow,
  opts: { accountName: string; accountId: string }
): Promise<{ channelGid: string | null; handle: string | null; error?: string }> {
  if (shopRow.shopify_channel_gid) {
    return {
      channelGid: shopRow.shopify_channel_gid,
      handle: shopRow.shopify_channel_handle ?? null,
    }
  }

  const token = await getValidShopAccessToken(admin, shopRow)
  const desiredHandle = channelHandleForVendor(opts.accountId)

  // Prefer handle lookup — avoids querying fields that older API versions lack.
  try {
    const byHandle = await shopifyAdminGraphql<{
      channelByHandle: { id: string; handle: string } | null
    }>({
      shop: shopRow.shop_domain,
      accessToken: token,
      query: CHANNEL_BY_HANDLE,
      variables: { handle: desiredHandle },
    })
    if (byHandle.channelByHandle) {
      await persistChannel(admin, shopRow.id, byHandle.channelByHandle)
      return {
        channelGid: byHandle.channelByHandle.id,
        handle: byHandle.channelByHandle.handle,
      }
    }
  } catch (e) {
    // channelByHandle may be unavailable on older schemas — fall through.
    console.warn('[shopify] channelByHandle', e instanceof Error ? e.message : e)
  }

  try {
    const listed = await shopifyAdminGraphql<{
      channels: { nodes: Array<{ id: string; handle: string; name?: string | null }> }
    }>({
      shop: shopRow.shop_domain,
      accessToken: token,
      query: CHANNELS_QUERY,
    })

    const existing =
      listed.channels?.nodes?.find((n) => n.handle === desiredHandle) ??
      listed.channels?.nodes?.find((n) => n.handle?.startsWith('offhrs-ca-')) ??
      null

    if (existing) {
      await persistChannel(admin, shopRow.id, existing)
      return { channelGid: existing.id, handle: existing.handle }
    }
  } catch (e) {
    console.warn('[shopify] channels list', e instanceof Error ? e.message : e)
  }

  const created = await shopifyAdminGraphql<{
    channelCreate: {
      channel: { id: string; handle: string } | null
      userErrors: Array<{ field?: string[] | null; message: string; code?: string }>
    }
  }>({
    shop: shopRow.shop_domain,
    accessToken: token,
    query: CHANNEL_CREATE,
    variables: {
      input: {
        handle: desiredHandle,
        specificationHandle: OFFHRS_CHANNEL_SPEC_HANDLE,
        accountId: opts.accountId,
        accountName: opts.accountName.slice(0, 120) || shopRow.shop_domain,
      },
    },
  })

  const errors = created.channelCreate?.userErrors ?? []
  if (errors.length > 0 || !created.channelCreate?.channel) {
    const msg = errors.map((e) => e.message).join('; ') || 'channelCreate failed'
    console.error('[shopify] channelCreate', msg)
    return { channelGid: null, handle: null, error: msg }
  }

  const channel = created.channelCreate.channel
  await persistChannel(admin, shopRow.id, channel)
  return { channelGid: channel.id, handle: channel.handle }
}

/** Trigger Contextual Product Feed full sync for published products. */
export async function triggerOffhrsChannelFullSync(
  admin: Admin,
  shopRow: ShopifyShopRow
): Promise<{ ok: boolean; error?: string }> {
  const channelId = shopRow.shopify_channel_gid
  if (!channelId) {
    return { ok: false, error: 'channel_not_connected' }
  }

  const token = await getValidShopAccessToken(admin, shopRow)
  const result = await shopifyAdminGraphql<{
    channelFullSync: {
      fullSyncTraceInfo: Array<{ country: string; language: string; operationId: string }> | null
      userErrors: Array<{ message: string }>
    }
  }>({
    shop: shopRow.shop_domain,
    accessToken: token,
    query: CHANNEL_FULL_SYNC,
    variables: { channelId },
  })

  const errors = result.channelFullSync?.userErrors ?? []
  if (errors.length > 0) {
    return { ok: false, error: errors.map((e) => e.message).join('; ') }
  }
  return { ok: true }
}

/** Best-effort channelDelete before local disconnect. */
export async function deleteOffhrsChannelConnection(
  admin: Admin,
  shopRow: ShopifyShopRow
): Promise<void> {
  const channelId = shopRow.shopify_channel_gid
  if (!channelId) return

  try {
    const token = await getValidShopAccessToken(admin, shopRow)
    const result = await shopifyAdminGraphql<{
      channelDelete: {
        deletedId: string | null
        userErrors: Array<{ message: string }>
      }
    }>({
      shop: shopRow.shop_domain,
      accessToken: token,
      query: CHANNEL_DELETE,
      variables: { id: channelId },
    })
    const errors = result.channelDelete?.userErrors ?? []
    if (errors.length > 0) {
      console.error('[shopify] channelDelete', errors.map((e) => e.message).join('; '))
    }
  } catch (e) {
    console.error('[shopify] channelDelete', e)
  }
}
