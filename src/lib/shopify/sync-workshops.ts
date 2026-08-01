import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePartnerSessionCategory } from '@/constants/categories'
import { decrypt, encrypt } from '@/lib/token-encryption'
import { parseWorkshopDateTimeInput } from '@/lib/workshop-timezone'
import {
  shopifyAdminGraphql,
  shopifyAdminRest,
  shopifyGidToNumericId,
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

type Admin = SupabaseClient

type MetafieldNode = { key: string; value: string }

type VariantNode = {
  id: string
  title: string
  price: string
  inventoryQuantity: number | null
  inventoryItem: { id: string } | null
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

/** Parse offhrs.starts_at into ISO UTC string, or null. */
export function parseOffhrsStartsAt(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const s = raw.trim()
  // Prefer Toronto wall-time parser for naive datetimes (matches partner sessions).
  const fromWorkshop = parseWorkshopDateTimeInput(s.replace(' ', 'T'))
  if (fromWorkshop) return fromWorkshop.toISOString()
  const asDate = new Date(s)
  if (!Number.isNaN(asDate.getTime())) return asDate.toISOString()
  return null
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
  sync_enabled: boolean
}

export async function loadShopifyShopForVendor(
  admin: Admin,
  vendorId: string
): Promise<ShopifyShopRow | null> {
  const { data } = await admin
    .from('vendor_shopify_shops')
    .select('id, vendor_id, shop_domain, access_token_encrypted, sync_enabled')
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
    .select('id, vendor_id, shop_domain, access_token_encrypted, sync_enabled')
    .eq('shop_domain', shopDomain)
    .maybeSingle()
  return data as ShopifyShopRow | null
}

export async function decryptShopToken(shop: ShopifyShopRow): Promise<string> {
  return decrypt(shop.access_token_encrypted)
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
  const startsRaw =
    variantMeta[OFFHRS_METAFIELD_STARTS_AT] ?? productMeta[OFFHRS_METAFIELD_STARTS_AT]
  const startsAt = parseOffhrsStartsAt(startsRaw)
  if (!startsAt) return 'skipped'

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

  const title =
    opts.product.variants.edges.length > 1 && opts.variant.title && opts.variant.title !== 'Default Title'
      ? `${opts.product.title} — ${opts.variant.title}`
      : opts.product.title

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

  const token = await decryptShopToken(shopRow)
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
  const token = await decryptShopToken(shopRow)
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
  }
): Promise<void> {
  const encrypted = encrypt(opts.accessToken)
  const now = new Date().toISOString()
  const { data: existing } = await admin
    .from('vendor_shopify_shops')
    .select('id')
    .eq('vendor_id', opts.vendorId)
    .maybeSingle()

  if (existing) {
    const { error } = await admin
      .from('vendor_shopify_shops')
      .update({
        shop_domain: opts.shopDomain,
        access_token_encrypted: encrypted,
        scope: opts.scope,
        sync_enabled: true,
        updated_at: now,
      })
      .eq('id', existing.id)
    if (error) throw new Error(`vendor_shopify_shops update failed: ${error.message}`)
    return
  }

  const { error } = await admin.from('vendor_shopify_shops').insert({
    vendor_id: opts.vendorId,
    shop_domain: opts.shopDomain,
    access_token_encrypted: encrypted,
    scope: opts.scope,
    sync_enabled: true,
    updated_at: now,
    installed_at: now,
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

const WEBHOOK_TOPICS = [
  'products/create',
  'products/update',
  'products/delete',
  'inventory_levels/update',
] as const

/** Register required webhooks (idempotent: skips topics that already exist for this address). */
export async function ensureShopifyWebhooks(opts: {
  shop: string
  accessToken: string
  callbackBaseUrl: string
}): Promise<void> {
  const address = `${opts.callbackBaseUrl.replace(/\/$/, '')}/api/webhooks/shopify`
  const existing = await shopifyAdminRest<{
    webhooks: Array<{ id: number; topic: string; address: string }>
  }>({
    shop: opts.shop,
    accessToken: opts.accessToken,
    path: '/webhooks.json',
  })

  const have = new Set(
    (existing.webhooks ?? [])
      .filter((w) => w.address === address)
      .map((w) => w.topic)
  )

  for (const topic of WEBHOOK_TOPICS) {
    if (have.has(topic)) continue
    await shopifyAdminRest({
      shop: opts.shop,
      accessToken: opts.accessToken,
      method: 'POST',
      path: '/webhooks.json',
      body: {
        webhook: {
          topic,
          address,
          format: 'json',
        },
      },
    })
  }
}
