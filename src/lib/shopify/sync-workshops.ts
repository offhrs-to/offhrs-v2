import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePartnerSessionCategory } from '@/constants/categories'
import { decrypt, encrypt } from '@/lib/token-encryption'
import {
  migrateShopifyOfflineTokenToExpiring,
  refreshShopifyOfflineToken,
  shopifyAdminGraphql,
  shopifyApiKey,
  shopifyApiSecret,
  shopifyGidToNumericId,
  type ShopifyAccessTokenResult,
} from './admin-client'
import {
  OFFHRS_METAFIELD_BOOK_URL,
  OFFHRS_METAFIELD_CAPACITY,
  OFFHRS_METAFIELD_CATEGORY,
  OFFHRS_METAFIELD_DURATION,
  OFFHRS_METAFIELD_NAMESPACE,
  OFFHRS_METAFIELD_STARTS_AT,
  OFFHRS_WORKSHOP_TAG,
} from './conventions'
import { resolveShopifySessionStart } from './parse-session-start'

type Admin = SupabaseClient

type MetafieldNode = { key: string; value: string }

type VariantNode = {
  id: string
  title: string
  price: string
  inventoryQuantity: number | null
  inventoryItem: { id: string } | null
  selectedOptions: Array<{ name: string; value: string }>
  metafields: { edges: Array<{ node: MetafieldNode }> }
}

type ProductNode = {
  id: string
  title: string
  handle: string
  status: string
  descriptionHtml: string | null
  tags: string[]
  featuredImage: { url: string } | null
  metafields: { edges: Array<{ node: MetafieldNode }> }
  variants: { edges: Array<{ node: VariantNode }> }
}

function metafieldMap(edges: Array<{ node: MetafieldNode }> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const e of edges ?? []) {
    if (e.node?.key) out[e.node.key] = e.node.value
  }
  return out
}

function formatPriceCad(amount: number): string {
  if (amount <= 0) return 'Free'
  return `$${amount.toFixed(2).replace(/\.00$/, '')} CAD`
}

function stripHtml(html: string | null | undefined): string | null {
  if (!html?.trim()) return null
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000) || null
}

function resolveBookUrl(opts: {
  shop: string
  handle: string
  variantId: string
  productMeta: Record<string, string>
  variantMeta: Record<string, string>
}): string {
  const override =
    opts.variantMeta[OFFHRS_METAFIELD_BOOK_URL]?.trim() ||
    opts.productMeta[OFFHRS_METAFIELD_BOOK_URL]?.trim()
  if (override) return override
  return `https://${opts.shop}/products/${opts.handle}?variant=${opts.variantId}`
}

export type ShopifyShopRow = {
  id: string
  vendor_id: string
  shop_domain: string
  access_token_encrypted: string
  refresh_token_encrypted: string | null
  access_token_expires_at: string | null
  refresh_token_expires_at: string | null
  sync_enabled: boolean
  billing_status?: string | null
  app_subscription_gid?: string | null
  scope?: string | null
}

const SHOP_TOKEN_SELECT =
  'id, vendor_id, shop_domain, access_token_encrypted, refresh_token_encrypted, access_token_expires_at, refresh_token_expires_at, sync_enabled, billing_status, app_subscription_gid, scope'

/** Refresh access token ~2 minutes before expiry. */
const ACCESS_TOKEN_REFRESH_SKEW_MS = 2 * 60 * 1000

export async function loadShopifyShopForVendor(
  admin: Admin,
  vendorId: string
): Promise<ShopifyShopRow | null> {
  const { data } = await admin
    .from('vendor_shopify_shops')
    .select(SHOP_TOKEN_SELECT)
    .eq('vendor_id', vendorId)
    .maybeSingle()
  return data as ShopifyShopRow | null
}

export async function loadShopifyShopByDomain(
  admin: Admin,
  shopDomain: string
): Promise<ShopifyShopRow | null> {
  const { data } = await admin
    .from('vendor_shopify_shops')
    .select(SHOP_TOKEN_SELECT)
    .eq('shop_domain', shopDomain)
    .maybeSingle()
  return data as ShopifyShopRow | null
}

function tokenExpiryFields(tokens: ShopifyAccessTokenResult): {
  access_token_expires_at: string | null
  refresh_token_expires_at: string | null
} {
  const now = Date.now()
  return {
    access_token_expires_at:
      typeof tokens.expires_in === 'number'
        ? new Date(now + tokens.expires_in * 1000).toISOString()
        : null,
    refresh_token_expires_at:
      typeof tokens.refresh_token_expires_in === 'number'
        ? new Date(now + tokens.refresh_token_expires_in * 1000).toISOString()
        : null,
  }
}

async function persistShopifyTokens(
  admin: Admin,
  shopId: string,
  tokens: ShopifyAccessTokenResult
): Promise<void> {
  const expiry = tokenExpiryFields(tokens)
  const { error } = await admin
    .from('vendor_shopify_shops')
    .update({
      access_token_encrypted: encrypt(tokens.access_token),
      refresh_token_encrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      access_token_expires_at: expiry.access_token_expires_at,
      refresh_token_expires_at: expiry.refresh_token_expires_at,
      scope: tokens.scope || undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shopId)
  if (error) throw new Error(`Failed to save Shopify tokens: ${error.message}`)
}

/**
 * Return a usable Admin API access token, refreshing or migrating when needed.
 * Public apps must use expiring offline tokens.
 */
export async function getValidShopAccessToken(
  admin: Admin,
  shopRow: ShopifyShopRow
): Promise<string> {
  const clientId = shopifyApiKey()
  const clientSecret = shopifyApiSecret()
  if (!clientId || !clientSecret) {
    throw new Error('Shopify OAuth is not configured')
  }

  const accessToken = decrypt(shopRow.access_token_encrypted)
  const expiresAtMs = shopRow.access_token_expires_at
    ? new Date(shopRow.access_token_expires_at).getTime()
    : null
  const accessExpiredOrMissing =
    expiresAtMs == null ||
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= Date.now() + ACCESS_TOKEN_REFRESH_SKEW_MS

  // Legacy non-expiring install: migrate once to expiring offline token.
  if (!shopRow.refresh_token_encrypted) {
    try {
      const migrated = await migrateShopifyOfflineTokenToExpiring({
        shop: shopRow.shop_domain,
        clientId,
        clientSecret,
        nonExpiringAccessToken: accessToken,
      })
      await persistShopifyTokens(admin, shopRow.id, migrated)
      return migrated.access_token
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(
        `Shopify token upgrade failed (${msg.slice(0, 160)}). Disconnect Shopify in Settings, then Connect again.`
      )
    }
  }

  if (!accessExpiredOrMissing) {
    return accessToken
  }

  const refreshToken = decrypt(shopRow.refresh_token_encrypted)
  const refreshed = await refreshShopifyOfflineToken({
    shop: shopRow.shop_domain,
    clientId,
    clientSecret,
    refreshToken,
  })
  await persistShopifyTokens(admin, shopRow.id, refreshed)
  return refreshed.access_token
}

const PRODUCTS_QUERY = `
  query OffhrsWorkshops($cursor: String) {
    products(first: 50, after: $cursor, query: "tag:${OFFHRS_WORKSHOP_TAG}") {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          status
          descriptionHtml
          tags
          featuredImage { url }
          metafields(namespace: "${OFFHRS_METAFIELD_NAMESPACE}", first: 20) {
            edges { node { key value } }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                price
                inventoryQuantity
                inventoryItem { id }
                selectedOptions { name value }
                metafields(namespace: "${OFFHRS_METAFIELD_NAMESPACE}", first: 20) {
                  edges { node { key value } }
                }
              }
            }
          }
        }
      }
    }
  }
`

const PRODUCT_BY_ID_QUERY = `
  query OffhrsProduct($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      status
      descriptionHtml
      tags
      featuredImage { url }
      metafields(namespace: "${OFFHRS_METAFIELD_NAMESPACE}", first: 20) {
        edges { node { key value } }
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            price
            inventoryQuantity
            inventoryItem { id }
            selectedOptions { name value }
            metafields(namespace: "${OFFHRS_METAFIELD_NAMESPACE}", first: 20) {
              edges { node { key value } }
            }
          }
        }
      }
    }
  }
`

async function fetchVendorContext(admin: Admin, vendorId: string) {
  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id, business_name, location_address, location_lat, location_lng, default_workshop_image_url')
    .eq('id', vendorId)
    .single()
  return vendor
}

async function upsertVariantEvent(
  admin: Admin,
  opts: {
    vendor: NonNullable<Awaited<ReturnType<typeof fetchVendorContext>>>
    shopDomain: string
    product: ProductNode
    variant: VariantNode
  }
): Promise<'upserted' | 'skipped'> {
  const productMeta = metafieldMap(opts.product.metafields?.edges)
  const variantMeta = metafieldMap(opts.variant.metafields?.edges)
  const startResolved = resolveShopifySessionStart({
    metafieldStartsAt:
      variantMeta[OFFHRS_METAFIELD_STARTS_AT] ?? productMeta[OFFHRS_METAFIELD_STARTS_AT] ?? null,
    selectedOptions: opts.variant.selectedOptions ?? [],
    variantTitle: opts.variant.title,
    productTitle: opts.product.title,
  })
  if (!startResolved.startsAt) return 'skipped'
  const startsAt = startResolved.startsAt

  const productId = shopifyGidToNumericId(opts.product.id)
  const variantId = shopifyGidToNumericId(opts.variant.id)
  const inventoryItemId = shopifyGidToNumericId(opts.variant.inventoryItem?.id ?? null)
  if (!productId || !variantId) return 'skipped'

  const inventoryQty = Math.max(0, opts.variant.inventoryQuantity ?? 0)
  const capacityRaw =
    variantMeta[OFFHRS_METAFIELD_CAPACITY] ?? productMeta[OFFHRS_METAFIELD_CAPACITY]
  const capacityParsed = capacityRaw ? Number.parseInt(capacityRaw, 10) : NaN
  const maxAttendees =
    Number.isFinite(capacityParsed) && capacityParsed > 0
      ? capacityParsed
      : Math.max(inventoryQty, 1)

  const durationRaw =
    variantMeta[OFFHRS_METAFIELD_DURATION] ?? productMeta[OFFHRS_METAFIELD_DURATION]
  const durationParsed = durationRaw ? Number.parseInt(durationRaw, 10) : NaN
  const durationMinutes =
    Number.isFinite(durationParsed) && durationParsed > 0 ? durationParsed : null

  const category = normalizePartnerSessionCategory(
    variantMeta[OFFHRS_METAFIELD_CATEGORY] ?? productMeta[OFFHRS_METAFIELD_CATEGORY] ?? 'Other'
  )

  const priceCad = Number.parseFloat(opts.variant.price || '0') || 0
  const externalLink = resolveBookUrl({
    shop: opts.shopDomain,
    handle: opts.product.handle,
    variantId,
    productMeta,
    variantMeta,
  })

  const productActive = opts.product.status === 'ACTIVE'
  const bookingStatus =
    !productActive || inventoryQty <= 0 ? 'fully_booked' : 'published'

  let title = opts.product.title
  if (
    (startResolved.source === 'option' || startResolved.source === 'variant_title') &&
    startResolved.matchedRaw
  ) {
    title = `${opts.product.title} — ${startResolved.matchedRaw}`
  } else if (
    opts.product.variants.edges.length > 1 &&
    opts.variant.title &&
    opts.variant.title !== 'Default Title'
  ) {
    title = `${opts.product.title} — ${opts.variant.title}`
  }

  const row = {
    listing_source: 'shopify',
    vendor_profile_id: opts.vendor.id,
    shopify_product_id: productId,
    shopify_variant_id: variantId,
    shopify_inventory_item_id: inventoryItemId,
    title,
    date: startsAt,
    description: stripHtml(opts.product.descriptionHtml),
    image_url:
      opts.product.featuredImage?.url ??
      (opts.vendor.default_workshop_image_url as string | null) ??
      null,
    location: (opts.vendor.location_address as string | null) ?? null,
    lat: (opts.vendor.location_lat as number | null) ?? null,
    lng: (opts.vendor.location_lng as number | null) ?? null,
    category,
    organizer: (opts.vendor.business_name as string | null)?.trim() || null,
    price: formatPriceCad(priceCad),
    price_cad: priceCad,
    max_attendees: maxAttendees,
    available_slots: inventoryQty,
    duration_minutes: durationMinutes,
    external_link: externalLink,
    booking_status: bookingStatus,
    workshop_series: 'one_day',
    series_occurrences: null,
    partner_series_meta: {
      source: 'shopify',
      shop_domain: opts.shopDomain,
      product_handle: opts.product.handle,
      start_source: startResolved.source,
      start_raw: startResolved.matchedRaw ?? null,
      start_option_name: startResolved.matchedOptionName ?? null,
    },
  }

  const { data: existing } = await admin
    .from('events')
    .select('id, max_attendees')
    .eq('shopify_variant_id', variantId)
    .maybeSingle()

  if (existing) {
    // Keep max_attendees from capacity metafield, else never shrink below prior max when inventory dips
    const nextMax =
      Number.isFinite(capacityParsed) && capacityParsed > 0
        ? capacityParsed
        : Math.max(existing.max_attendees ?? 1, inventoryQty, 1)
    const { error } = await admin
      .from('events')
      .update({ ...row, max_attendees: nextMax })
      .eq('id', existing.id)
    if (error) throw new Error(`events update failed: ${error.message}`)
  } else {
    const { error } = await admin.from('events').insert(row)
    if (error) throw new Error(`events insert failed: ${error.message}`)
  }

  return 'upserted'
}

async function archiveMissingVariants(
  admin: Admin,
  vendorId: string,
  keepVariantIds: Set<string>
): Promise<number> {
  const { data: rows } = await admin
    .from('events')
    .select('id, shopify_variant_id')
    .eq('vendor_profile_id', vendorId)
    .eq('listing_source', 'shopify')
    .neq('booking_status', 'archived')

  let archived = 0
  for (const row of rows ?? []) {
    const vid = row.shopify_variant_id as string | null
    if (!vid || keepVariantIds.has(vid)) continue
    const { error } = await admin
      .from('events')
      .update({ booking_status: 'archived', available_slots: 0 })
      .eq('id', row.id)
    if (!error) archived += 1
  }
  return archived
}

export type SyncResult = {
  products: number
  upserted: number
  skipped: number
  archived: number
}

/** Full sync of tagged products for a connected shop. */
export async function syncShopifyWorkshopsForShop(
  admin: Admin,
  shopRow: ShopifyShopRow
): Promise<SyncResult> {
  if (!shopRow.sync_enabled) {
    return { products: 0, upserted: 0, skipped: 0, archived: 0 }
  }

  const token = await getValidShopAccessToken(admin, shopRow)
  const vendor = await fetchVendorContext(admin, shopRow.vendor_id)
  if (!vendor) throw new Error('Vendor not found for Shopify shop')

  const keepVariantIds = new Set<string>()
  let cursor: string | null = null
  let products = 0
  let upserted = 0
  let skipped = 0
  let hasNext = true

  type ProductsPage = {
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
      edges: Array<{ node: ProductNode }>
    }
  }

  while (hasNext) {
    const data: ProductsPage = await shopifyAdminGraphql<ProductsPage>({
      shop: shopRow.shop_domain,
      accessToken: token,
      query: PRODUCTS_QUERY,
      variables: { cursor },
    })

    for (const edge of data.products.edges) {
      const product = edge.node
      products += 1
      const tags = (product.tags ?? []).map((t: string) => t.toLowerCase())
      if (!tags.includes(OFFHRS_WORKSHOP_TAG.toLowerCase())) {
        continue
      }
      for (const vEdge of product.variants.edges) {
        const variant = vEdge.node
        const variantId = shopifyGidToNumericId(variant.id)
        const result = await upsertVariantEvent(admin, {
          vendor,
          shopDomain: shopRow.shop_domain,
          product,
          variant,
        })
        if (result === 'upserted' && variantId) {
          keepVariantIds.add(variantId)
          upserted += 1
        } else {
          skipped += 1
        }
      }
    }

    hasNext = data.products.pageInfo.hasNextPage
    cursor = data.products.pageInfo.endCursor
  }

  const archived = await archiveMissingVariants(admin, shopRow.vendor_id, keepVariantIds)

  await admin
    .from('vendor_shopify_shops')
    .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', shopRow.id)

  return { products, upserted, skipped, archived }
}

/** Re-sync a single Shopify product (webhook). Archives variants if untagged/deleted. */
export async function syncShopifyProductByNumericId(
  admin: Admin,
  shopRow: ShopifyShopRow,
  productNumericId: string
): Promise<SyncResult> {
  const token = await getValidShopAccessToken(admin, shopRow)
  const vendor = await fetchVendorContext(admin, shopRow.vendor_id)
  if (!vendor) throw new Error('Vendor not found')

  const gid = `gid://shopify/Product/${productNumericId}`
  const data = await shopifyAdminGraphql<{ product: ProductNode | null }>({
    shop: shopRow.shop_domain,
    accessToken: token,
    query: PRODUCT_BY_ID_QUERY,
    variables: { id: gid },
  })

  const product = data.product
  const keepVariantIds = new Set<string>()
  let upserted = 0
  let skipped = 0

  if (
    product &&
    product.tags?.map((t) => t.toLowerCase()).includes(OFFHRS_WORKSHOP_TAG.toLowerCase())
  ) {
    for (const vEdge of product.variants.edges) {
      const variant = vEdge.node
      const variantId = shopifyGidToNumericId(variant.id)
      const result = await upsertVariantEvent(admin, {
        vendor,
        shopDomain: shopRow.shop_domain,
        product,
        variant,
      })
      if (result === 'upserted' && variantId) {
        keepVariantIds.add(variantId)
        upserted += 1
      } else {
        skipped += 1
      }
    }
  }

  // Archive this product's variants that are no longer valid
  const { data: existing } = await admin
    .from('events')
    .select('id, shopify_variant_id')
    .eq('vendor_profile_id', shopRow.vendor_id)
    .eq('listing_source', 'shopify')
    .eq('shopify_product_id', productNumericId)
    .neq('booking_status', 'archived')

  let archived = 0
  for (const row of existing ?? []) {
    const vid = row.shopify_variant_id as string | null
    if (vid && keepVariantIds.has(vid)) continue
    const { error } = await admin
      .from('events')
      .update({ booking_status: 'archived', available_slots: 0 })
      .eq('id', row.id)
    if (!error) archived += 1
  }

  return { products: product ? 1 : 0, upserted, skipped, archived }
}

export async function archiveShopifyProductEvents(
  admin: Admin,
  vendorId: string,
  productNumericId: string
): Promise<number> {
  const { data } = await admin
    .from('events')
    .update({ booking_status: 'archived', available_slots: 0 })
    .eq('vendor_profile_id', vendorId)
    .eq('listing_source', 'shopify')
    .eq('shopify_product_id', productNumericId)
    .neq('booking_status', 'archived')
    .select('id')
  return data?.length ?? 0
}

export async function applyShopifyInventoryLevel(
  admin: Admin,
  inventoryItemId: string,
  available: number
): Promise<boolean> {
  const qty = Math.max(0, available)
  const { data: event } = await admin
    .from('events')
    .select('id, booking_status, max_attendees')
    .eq('shopify_inventory_item_id', String(inventoryItemId))
    .eq('listing_source', 'shopify')
    .maybeSingle()

  if (!event) return false

  let bookingStatus = event.booking_status as string
  if (bookingStatus !== 'archived' && bookingStatus !== 'draft') {
    bookingStatus = qty <= 0 ? 'fully_booked' : 'published'
  }

  const { error } = await admin
    .from('events')
    .update({
      available_slots: qty,
      booking_status: bookingStatus,
      max_attendees: Math.max(event.max_attendees ?? 1, qty, 1),
    })
    .eq('id', event.id)

  if (error) throw new Error(error.message)
  return true
}

export async function upsertVendorShopifyShop(
  admin: Admin,
  opts: {
    vendorId: string
    shopDomain: string
    accessToken: string
    scope: string
    expiresIn?: number
    refreshToken?: string
    refreshTokenExpiresIn?: number
  }
): Promise<void> {
  const now = Date.now()
  const encrypted = encrypt(opts.accessToken)
  const refreshEncrypted = opts.refreshToken ? encrypt(opts.refreshToken) : null
  const accessExpires =
    typeof opts.expiresIn === 'number'
      ? new Date(now + opts.expiresIn * 1000).toISOString()
      : null
  const refreshExpires =
    typeof opts.refreshTokenExpiresIn === 'number'
      ? new Date(now + opts.refreshTokenExpiresIn * 1000).toISOString()
      : null
  const updatedAt = new Date(now).toISOString()

  const { data: existing } = await admin
    .from('vendor_shopify_shops')
    .select('id')
    .eq('vendor_id', opts.vendorId)
    .maybeSingle()

  const payload = {
    shop_domain: opts.shopDomain,
    access_token_encrypted: encrypted,
    refresh_token_encrypted: refreshEncrypted,
    access_token_expires_at: accessExpires,
    refresh_token_expires_at: refreshExpires,
    scope: opts.scope,
    sync_enabled: true,
    updated_at: updatedAt,
  }

  if (existing) {
    const { error } = await admin.from('vendor_shopify_shops').update(payload).eq('id', existing.id)
    if (error) throw new Error(`vendor_shopify_shops update failed: ${error.message}`)
    return
  }

  const { error } = await admin.from('vendor_shopify_shops').insert({
    vendor_id: opts.vendorId,
    ...payload,
    installed_at: updatedAt,
  })
  if (error) throw new Error(`vendor_shopify_shops insert failed: ${error.message}`)
}

export async function disconnectVendorShopify(
  admin: Admin,
  vendorId: string,
  opts?: { archiveListings?: boolean }
): Promise<void> {
  if (opts?.archiveListings !== false) {
    await admin
      .from('events')
      .update({ booking_status: 'archived', available_slots: 0 })
      .eq('vendor_profile_id', vendorId)
      .eq('listing_source', 'shopify')
      .neq('booking_status', 'archived')
  }
  await admin.from('vendor_shopify_shops').delete().eq('vendor_id', vendorId)
}

/** GDPR shop/redact: wipe linked shop data by myshopify domain. */
export async function disconnectShopifyShopByDomain(
  admin: Admin,
  shopDomain: string
): Promise<boolean> {
  const shopRow = await loadShopifyShopByDomain(admin, shopDomain)
  if (!shopRow) {
    await admin.from('shopify_pending_installs').delete().eq('shop_domain', shopDomain)
    return false
  }
  await disconnectVendorShopify(admin, shopRow.vendor_id)
  await admin.from('shopify_pending_installs').delete().eq('shop_domain', shopDomain)
  return true
}

/** GraphQL Admin webhook topics (App Store: no REST Admin for new public apps). */
const WEBHOOK_GRAPHQL_TOPICS = [
  'PRODUCTS_CREATE',
  'PRODUCTS_UPDATE',
  'PRODUCTS_DELETE',
  'INVENTORY_LEVELS_UPDATE',
  'APP_SUBSCRIPTIONS_UPDATE',
] as const

const WEBHOOK_SUBSCRIPTIONS_QUERY = `
  query WebhookSubscriptions($first: Int!) {
    webhookSubscriptions(first: $first) {
      edges {
        node {
          id
          topic
          endpoint {
            __typename
            ... on WebhookHttpEndpoint {
              callbackUrl
            }
          }
        }
      }
    }
  }
`

const WEBHOOK_SUBSCRIPTION_CREATE = `
  mutation WebhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
    webhookSubscriptionCreate(
      topic: $topic
      webhookSubscription: { callbackUrl: $callbackUrl, format: JSON }
    ) {
      userErrors { field message }
      webhookSubscription { id topic }
    }
  }
`

/** Register required webhooks via GraphQL (idempotent per callback URL + topic). */
export async function ensureShopifyWebhooks(opts: {
  shop: string
  accessToken: string
  callbackBaseUrl: string
}): Promise<void> {
  const address = `${opts.callbackBaseUrl.replace(/\/$/, '')}/api/webhooks/shopify`

  type SubEdge = {
    node: {
      id: string
      topic: string
      endpoint: { __typename?: string; callbackUrl?: string } | null
    }
  }

  const existing = await shopifyAdminGraphql<{
    webhookSubscriptions: { edges: SubEdge[] }
  }>({
    shop: opts.shop,
    accessToken: opts.accessToken,
    query: WEBHOOK_SUBSCRIPTIONS_QUERY,
    variables: { first: 50 },
  })

  const have = new Set(
    (existing.webhookSubscriptions?.edges ?? [])
      .filter((e) => e.node.endpoint?.callbackUrl === address)
      .map((e) => e.node.topic)
  )

  for (const topic of WEBHOOK_GRAPHQL_TOPICS) {
    if (have.has(topic)) continue
    const created = await shopifyAdminGraphql<{
      webhookSubscriptionCreate: {
        userErrors: Array<{ field: string[] | null; message: string }>
        webhookSubscription: { id: string } | null
      }
    }>({
      shop: opts.shop,
      accessToken: opts.accessToken,
      query: WEBHOOK_SUBSCRIPTION_CREATE,
      variables: { topic, callbackUrl: address },
    })
    const errors = created.webhookSubscriptionCreate?.userErrors ?? []
    if (errors.length > 0) {
      const msg = errors.map((e) => e.message).join('; ')
      // Already registered is fine under race / reinstall.
      if (!/already|taken|exists/i.test(msg)) {
        throw new Error(`webhookSubscriptionCreate ${topic}: ${msg}`)
      }
    }
  }
}
