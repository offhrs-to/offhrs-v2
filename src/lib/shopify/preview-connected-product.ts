/**
 * Admin-only Shopify Sync deep scan via a connected shop's Admin API token.
 * Reads all product/variant metafields (including offhrs.*) and partner profile location.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { shopifyAdminGraphql, shopifyGidToNumericId } from './admin-client'
import {
  OFFHRS_METAFIELD_BOOK_URL,
  OFFHRS_METAFIELD_CAPACITY,
  OFFHRS_METAFIELD_CATEGORY,
  OFFHRS_METAFIELD_DURATION,
  OFFHRS_METAFIELD_NAMESPACE,
  OFFHRS_METAFIELD_STARTS_AT,
  OFFHRS_WORKSHOP_TAG,
} from './conventions'
import {
  parseShopifyWallDateTime,
  resolveShopifySessionStart,
  type ShopifySelectedOption,
} from './parse-session-start'
import {
  getValidShopAccessToken,
  loadShopifyShopByDomain,
  type ShopifyShopRow,
} from './sync-workshops'
import { shopifyBillingAllowsSync } from './billing'
import {
  parseShopifyProductUrl,
  type SyncPreviewCheck,
  type SyncPreviewDemoCard,
  type SyncPreviewResult,
  type SyncPreviewSession,
  type SyncPreviewVerdict,
} from './preview-public-product'

type Admin = SupabaseClient

type MetaNode = { namespace: string; key: string; value: string; type: string }

type AdminVariant = {
  id: string
  title: string
  price: string
  inventoryQuantity: number | null
  selectedOptions: ShopifySelectedOption[]
  metafields: { edges: Array<{ node: MetaNode }> }
}

type AdminProduct = {
  id: string
  title: string
  handle: string
  status: string
  descriptionHtml: string | null
  tags: string[]
  vendor: string | null
  productType: string | null
  featuredImage: { url: string } | null
  options: Array<{ name: string; values: string[] }> | null
  metafields: { edges: Array<{ node: MetaNode }> }
  variants: { edges: Array<{ node: AdminVariant }> }
}

export type ConnectedShopListItem = {
  shop_domain: string
  vendor_id: string
  business_name: string | null
  sync_enabled: boolean
  billing_status: string | null
}

export type MetafieldPreview = {
  namespace: string
  key: string
  value: string
  type: string
  scope: 'product' | 'variant'
  variantTitle?: string
}

export type ConnectedDeepExtras = {
  mode: 'connected'
  shopDomain: string
  vendorId: string
  businessName: string | null
  syncEnabled: boolean
  billingStatus: string | null
  partnerLocation: string | null
  productStatus: string
  offhrsMetafields: MetafieldPreview[]
  allMetafields: MetafieldPreview[]
  suggestedStartMetafields: MetafieldPreview[]
  suggestedLocationMetafields: MetafieldPreview[]
  usesOffhrsStartsAt: boolean
}

export type ConnectedSyncPreviewResult = SyncPreviewResult & {
  deep: ConnectedDeepExtras
}

function stripHtml(html: string | null | undefined): string | null {
  if (!html?.trim()) return null
  return (
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000) || null
  )
}

function formatTorontoLabel(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function looksLikeMenuOption(name: string): boolean {
  return /^(menu|item|food|dish|pizza|pasta|flavour|flavor|choice|add.?on)$/i.test(name.trim())
}

function flattenMetafields(
  edges: Array<{ node: MetaNode }> | undefined,
  scope: 'product' | 'variant',
  variantTitle?: string
): MetafieldPreview[] {
  return (edges ?? []).map((e) => ({
    namespace: e.node.namespace,
    key: e.node.key,
    value: e.node.value,
    type: e.node.type,
    scope,
    variantTitle,
  }))
}

function offhrsMap(metas: MetafieldPreview[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of metas) {
    if (m.namespace === OFFHRS_METAFIELD_NAMESPACE && m.key) out[m.key] = m.value
  }
  return out
}

function suggestStartMetafields(metas: MetafieldPreview[]): MetafieldPreview[] {
  return metas.filter((m) => {
    if (m.namespace === OFFHRS_METAFIELD_NAMESPACE && m.key === OFFHRS_METAFIELD_STARTS_AT) {
      return Boolean(parseShopifyWallDateTime(m.value))
    }
    if (/start|date|time|when|schedule|event/i.test(`${m.namespace}.${m.key}`)) {
      return Boolean(parseShopifyWallDateTime(m.value) || parseShopifyWallDateTime(m.value.replace('T', ' ')))
    }
    return Boolean(parseShopifyWallDateTime(m.value))
  })
}

function suggestLocationMetafields(metas: MetafieldPreview[]): MetafieldPreview[] {
  return metas.filter((m) => {
    const nk = `${m.namespace}.${m.key}`.toLowerCase()
    if (!/locat|venue|address|place|studio|map|geo/i.test(nk)) return false
    return m.value.trim().length >= 3 && m.value.trim().length < 500
  })
}

const PRODUCT_BY_HANDLE_QUERY = `
  query OffhrsSyncPreviewProduct($handle: String!) {
    productByHandle(handle: $handle) {
      id
      title
      handle
      status
      descriptionHtml
      tags
      vendor
      productType
      featuredImage { url }
      options { name values }
      metafields(first: 50) {
        edges { node { namespace key value type } }
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            price
            inventoryQuantity
            selectedOptions { name value }
            metafields(first: 30) {
              edges { node { namespace key value type } }
            }
          }
        }
      }
    }
  }
`

export async function listConnectedShopifyShops(admin: Admin): Promise<ConnectedShopListItem[]> {
  const { data: shops, error } = await admin
    .from('vendor_shopify_shops')
    .select('shop_domain, vendor_id, sync_enabled, billing_status')
    .order('shop_domain', { ascending: true })

  if (error) throw new Error(error.message)
  if (!shops?.length) return []

  const vendorIds = [...new Set(shops.map((s) => s.vendor_id as string))]
  const { data: vendors } = await admin
    .from('vendor_profiles')
    .select('id, business_name')
    .in('id', vendorIds)

  const nameById = new Map((vendors ?? []).map((v) => [v.id as string, v.business_name as string | null]))

  return shops.map((s) => ({
    shop_domain: s.shop_domain as string,
    vendor_id: s.vendor_id as string,
    business_name: nameById.get(s.vendor_id as string) ?? null,
    sync_enabled: Boolean(s.sync_enabled),
    billing_status: (s.billing_status as string | null) ?? null,
  }))
}

/**
 * Resolve which connected shop to use for a product URL.
 * Prefer explicit shopDomain; else myshopify host; else try productByHandle across shops.
 */
export async function resolveConnectedShopForPreview(
  admin: Admin,
  opts: { shopDomain?: string | null; productUrl: string }
): Promise<{ shop: ShopifyShopRow; handle: string; storefrontHost: string } | { error: string }> {
  const parsed = parseShopifyProductUrl(opts.productUrl)
  if (!parsed) {
    return {
      error: 'Paste a full Shopify product URL, e.g. https://example.myshopify.com/products/my-workshop',
    }
  }

  let shopDomain = opts.shopDomain?.trim().toLowerCase() || null
  if (shopDomain && !shopDomain.endsWith('.myshopify.com')) {
    shopDomain = `${shopDomain.replace(/\.myshopify\.com$/i, '')}.myshopify.com`
  }

  if (!shopDomain && parsed.shopHost.endsWith('.myshopify.com')) {
    shopDomain = parsed.shopHost
  }

  if (shopDomain) {
    const shop = await loadShopifyShopByDomain(admin, shopDomain)
    if (!shop) {
      return { error: `No connected shop for ${shopDomain}. Partner must install the offhrs app first.` }
    }
    return { shop, handle: parsed.handle, storefrontHost: parsed.shopHost }
  }

  // Custom domain: probe connected shops for this handle (capped).
  const list = await listConnectedShopifyShops(admin)
  if (!list.length) {
    return {
      error:
        'No connected Shopify shops in the database. Select a shop after a partner installs, or use public scan.',
    }
  }

  const maxProbe = Math.min(list.length, 20)
  for (let i = 0; i < maxProbe; i++) {
    const item = list[i]!
    const shop = await loadShopifyShopByDomain(admin, item.shop_domain)
    if (!shop) continue
    try {
      const token = await getValidShopAccessToken(admin, shop)
      const data = await shopifyAdminGraphql<{ productByHandle: AdminProduct | null }>({
        shop: shop.shop_domain,
        accessToken: token,
        query: PRODUCT_BY_HANDLE_QUERY,
        variables: { handle: parsed.handle },
      })
      if (data.productByHandle?.handle === parsed.handle) {
        return { shop, handle: parsed.handle, storefrontHost: parsed.shopHost }
      }
    } catch {
      /* try next shop */
    }
  }

  return {
    error: `Could not auto-match “${parsed.handle}” to a connected shop. Pick the partner’s .myshopify.com shop from the dropdown.`,
  }
}

export async function analyzeConnectedShopifyProduct(
  admin: Admin,
  opts: { productUrl: string; shopDomain?: string | null }
): Promise<ConnectedSyncPreviewResult | { error: string }> {
  const resolved = await resolveConnectedShopForPreview(admin, {
    shopDomain: opts.shopDomain,
    productUrl: opts.productUrl,
  })
  if ('error' in resolved) return resolved

  const { shop, handle, storefrontHost } = resolved

  let accessToken: string
  try {
    accessToken = await getValidShopAccessToken(admin, shop)
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Failed to refresh Shopify access token',
    }
  }

  let product: AdminProduct | null
  try {
    const data = await shopifyAdminGraphql<{ productByHandle: AdminProduct | null }>({
      shop: shop.shop_domain,
      accessToken,
      query: PRODUCT_BY_HANDLE_QUERY,
      variables: { handle },
    })
    product = data.productByHandle
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Admin API product fetch failed' }
  }

  if (!product) {
    return { error: `Product handle “${handle}” not found on ${shop.shop_domain}.` }
  }

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id, business_name, location_address')
    .eq('id', shop.vendor_id)
    .maybeSingle()

  const productMetas = flattenMetafields(product.metafields?.edges, 'product')
  const variantMetas: MetafieldPreview[] = []
  for (const edge of product.variants?.edges ?? []) {
    variantMetas.push(
      ...flattenMetafields(edge.node.metafields?.edges, 'variant', edge.node.title)
    )
  }
  const allMetafields = [...productMetas, ...variantMetas]
  const offhrsMetafields = allMetafields.filter((m) => m.namespace === OFFHRS_METAFIELD_NAMESPACE)
  const productOffhrs = offhrsMap(productMetas)

  const tags = product.tags ?? []
  const hasOffhrsTag = tags.some((t) => t.toLowerCase() === OFFHRS_WORKSHOP_TAG.toLowerCase())
  const optionNames = (product.options ?? []).map((o) => o.name)
  const menuLike = optionNames.some(looksLikeMenuOption)

  const productUrl = `https://${storefrontHost}/products/${product.handle}`
  const numericProductId = Number(shopifyGidToNumericId(product.id) ?? 0)

  const sessions: SyncPreviewSession[] = (product.variants?.edges ?? []).map(({ node: variant }) => {
    const vMeta = offhrsMap(flattenMetafields(variant.metafields?.edges, 'variant'))
    const start = resolveShopifySessionStart({
      metafieldStartsAt: vMeta[OFFHRS_METAFIELD_STARTS_AT] ?? productOffhrs[OFFHRS_METAFIELD_STARTS_AT] ?? null,
      selectedOptions: variant.selectedOptions ?? [],
      variantTitle: variant.title,
      productTitle: product!.title,
    })
    const variantId = shopifyGidToNumericId(variant.id) ?? variant.id
    const bookOverride =
      vMeta[OFFHRS_METAFIELD_BOOK_URL]?.trim() || productOffhrs[OFFHRS_METAFIELD_BOOK_URL]?.trim()
    const bookUrl =
      bookOverride || `https://${storefrontHost}/products/${product!.handle}?variant=${variantId}`

    return {
      variantId,
      variantTitle: variant.title,
      price: variant.price,
      available: (variant.inventoryQuantity ?? 0) > 0,
      inventoryQuantity: variant.inventoryQuantity,
      selectedOptions: variant.selectedOptions ?? [],
      start,
      wouldSync: Boolean(start.startsAt),
      bookUrl,
    }
  })

  const syncable = sessions.filter((s) => s.wouldSync)
  const skippedCount = sessions.length - syncable.length
  const uniqueStarts = new Set(syncable.map((s) => s.start.startsAt).filter(Boolean) as string[])
  const duplicateSameStart = syncable.length > 1 && uniqueStarts.size === 1
  const usesOffhrsStartsAt = syncable.some((s) => s.start.source === 'metafield')

  const billingOk = shopifyBillingAllowsSync({
    billingStatus: shop.billing_status,
    shopDomain: shop.shop_domain,
  })

  const checks: SyncPreviewCheck[] = [
    {
      id: 'connected_shop',
      ok: true,
      label: 'Connected shop',
      detail: `${shop.shop_domain} · vendor ${vendor?.business_name ?? shop.vendor_id}`,
    },
    {
      id: 'sync_enabled',
      ok: shop.sync_enabled,
      label: 'Sync enabled',
      detail: shop.sync_enabled
        ? 'Shop has sync_enabled = true.'
        : 'Sync is disabled on this shop row — enable in Settings after billing.',
    },
    {
      id: 'billing',
      ok: billingOk,
      label: 'Sync billing',
      detail: `billing_status = ${shop.billing_status ?? 'null'}${
        billingOk ? ' (allowed)' : ' (need active billing or a comped shop domain)'
      }.`,
    },
    {
      id: 'offhrs_tag',
      ok: hasOffhrsTag,
      label: `Tag \`${OFFHRS_WORKSHOP_TAG}\``,
      detail: hasOffhrsTag
        ? 'Product is tagged for Sync.'
        : `Missing. Current tags: ${tags.length ? tags.join(', ') : '(none)'}.`,
    },
    {
      id: 'session_start',
      ok: syncable.length > 0,
      label: 'Parseable session start (Admin)',
      detail:
        syncable.length > 0
          ? `${syncable.length} of ${sessions.length} variant(s) would sync. Sources include metafields.`
          : 'No parseable start from offhrs.starts_at, Date/Time options, or titles.',
    },
  ]

  const warnings: string[] = []
  if (menuLike) {
    warnings.push(
      `Option "${optionNames.find(looksLikeMenuOption)}" looks like a menu/choice, not session times.`
    )
  }
  if (duplicateSameStart) {
    warnings.push(
      `All syncable variants share the same start (${formatTorontoLabel(
        [...uniqueStarts][0]!
      )}). Guests would see duplicate identical time pills.`
    )
  }
  if (product.status !== 'ACTIVE') {
    warnings.push(`Product status is ${product.status} — synced sessions would show as fully booked / inactive.`)
  }

  const suggestedStartMetafields = suggestStartMetafields(allMetafields)
  const suggestedLocationMetafields = suggestLocationMetafields(allMetafields)

  if (!usesOffhrsStartsAt && suggestedStartMetafields.length > 0 && syncable.length === 0) {
    warnings.push(
      `Found metafield(s) that look like dates but Sync only reads ${OFFHRS_METAFIELD_NAMESPACE}.${OFFHRS_METAFIELD_STARTS_AT} (or Date options). Map or copy into offhrs.starts_at: ${suggestedStartMetafields
        .slice(0, 5)
        .map((m) => `${m.namespace}.${m.key}`)
        .join(', ')}.`
    )
  }
  if (suggestedLocationMetafields.length > 0) {
    warnings.push(
      `Location-like metafields exist (${suggestedLocationMetafields
        .slice(0, 3)
        .map((m) => `${m.namespace}.${m.key}`)
        .join(', ')}) but Sync uses the partner profile address today.`
    )
  }

  let verdict: SyncPreviewVerdict = 'needs_setup'
  let summary: string
  if (hasOffhrsTag && syncable.length > 0 && shop.sync_enabled && billingOk) {
    verdict = 'ready'
    summary = `Deep scan: would sync ${syncable.length} session(s) with current Admin data.`
  } else if (hasOffhrsTag && syncable.length > 0) {
    verdict = 'needs_setup'
    summary = `Sessions are parseable (${syncable.length}), but sync_enabled/billing still need to be in place for production Sync.`
  } else if (syncable.length === 0) {
    verdict = hasOffhrsTag ? 'blocked' : 'needs_setup'
    summary = hasOffhrsTag
      ? 'Tagged, but no parseable start even with Admin metafields — set offhrs.starts_at or Date options.'
      : 'Connected shop can read the product, but tag and/or start time still need setup.'
  } else {
    verdict = 'needs_setup'
    summary = `Parseable starts for ${syncable.length} variant(s); finish tagging and Sync billing to go live.`
  }

  const partnerLocation = (vendor?.location_address as string | null) ?? null
  const demo: SyncPreviewDemoCard = {
    title: product.title,
    description: stripHtml(product.descriptionHtml),
    imageUrl: product.featuredImage?.url ?? null,
    organizer: (vendor?.business_name as string | null) ?? product.vendor,
    locationNote: partnerLocation
      ? `Partner profile location: ${partnerLocation}`
      : 'No partner profile location set — map pin would be empty until they add an address.',
    priceLabel: syncable[0]?.price != null ? `$${syncable[0].price}` : product.variants?.edges?.[0]?.node.price
      ? `From $${product.variants.edges[0].node.price}`
      : null,
    bookUrl: syncable[0]?.bookUrl ?? productUrl,
    sessionTimes: syncable
      .map((s) => (s.start.startsAt ? formatTorontoLabel(s.start.startsAt) : null))
      .filter((x): x is string => Boolean(x)),
    sessionCount: syncable.length,
  }

  const deep: ConnectedDeepExtras = {
    mode: 'connected',
    shopDomain: shop.shop_domain,
    vendorId: shop.vendor_id,
    businessName: (vendor?.business_name as string | null) ?? null,
    syncEnabled: shop.sync_enabled,
    billingStatus: shop.billing_status ?? null,
    partnerLocation,
    productStatus: product.status,
    offhrsMetafields,
    allMetafields: allMetafields.slice(0, 80),
    suggestedStartMetafields,
    suggestedLocationMetafields,
    usesOffhrsStartsAt,
  }

  return {
    verdict,
    summary,
    inputUrl: opts.productUrl.trim(),
    shopHost: storefrontHost,
    productUrl,
    handle: product.handle,
    product: {
      id: numericProductId || 0,
      title: product.title,
      vendor: product.vendor,
      productType: product.productType,
      tags,
      hasOffhrsTag,
      optionNames,
    },
    checks,
    warnings,
    sessions,
    syncableCount: syncable.length,
    skippedCount,
    demo,
    themeHints: null,
    limitations: [
      'Deep scan uses Admin API (metafields, inventory, status) for a connected install.',
      'Still does not write to the database.',
      `Known offhrs keys: ${OFFHRS_METAFIELD_STARTS_AT}, ${OFFHRS_METAFIELD_BOOK_URL}, ${OFFHRS_METAFIELD_CAPACITY}, ${OFFHRS_METAFIELD_DURATION}, ${OFFHRS_METAFIELD_CATEGORY}.`,
    ],
    deep,
  }
}
