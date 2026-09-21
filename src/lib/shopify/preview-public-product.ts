/**
 * Admin-only Shopify Sync feasibility preview from a public product URL.
 * Uses Storefront product JSON (no Admin API / install required).
 */

import { OFFHRS_WORKSHOP_TAG } from './conventions'
import {
  resolveShopifySessionStart,
  type ResolveSessionStartResult,
  type ShopifySelectedOption,
} from './parse-session-start'

const FETCH_TIMEOUT_MS = 12_000
const USER_AGENT = 'offhrs-ShopifySyncPreview/1.0'

export type SyncPreviewVerdict = 'ready' | 'needs_setup' | 'blocked' | 'error'

export type SyncPreviewCheck = {
  id: string
  ok: boolean
  label: string
  detail: string
}

export type SyncPreviewSession = {
  variantId: string
  variantTitle: string
  price: string
  available: boolean | null
  inventoryQuantity: number | null
  selectedOptions: ShopifySelectedOption[]
  start: ResolveSessionStartResult
  wouldSync: boolean
  bookUrl: string
}

export type SyncPreviewThemeHints = {
  dateText: string | null
  timeText: string | null
  locationText: string | null
  note: string
}

export type SyncPreviewDemoCard = {
  title: string
  description: string | null
  imageUrl: string | null
  organizer: string | null
  locationNote: string
  /** Short venue line as shown on the offhrs EventCard */
  locationLabel: string
  priceLabel: string | null
  /** Numeric CAD for EventCard-style price row */
  priceCad: number | null
  bookUrl: string
  sessionTimes: string[]
  /** How many sessions Sync would create today from public data */
  sessionCount: number
  category: string
  /** Earliest session label (EventCard date row) */
  earliestDateLabel: string | null
  /** True when multiple syncable starts → “Multiple dates” on the card */
  isMultipleDates: boolean
  /** Whether a listing would appear in the offhrs feed with current data */
  wouldAppearOnApp: boolean
  appearanceNote: string
  bookingCta: string
}

export type SyncPreviewResult = {
  verdict: SyncPreviewVerdict
  summary: string
  inputUrl: string
  shopHost: string
  productUrl: string
  handle: string
  product: {
    id: number
    title: string
    vendor: string | null
    productType: string | null
    tags: string[]
    hasOffhrsTag: boolean
    optionNames: string[]
  }
  checks: SyncPreviewCheck[]
  warnings: string[]
  sessions: SyncPreviewSession[]
  syncableCount: number
  skippedCount: number
  demo: SyncPreviewDemoCard
  themeHints: SyncPreviewThemeHints | null
  limitations: string[]
}

type PublicVariant = {
  id: number
  title: string
  price: string
  available?: boolean
  inventory_quantity?: number | null
  option1: string | null
  option2: string | null
  option3: string | null
}

type PublicProduct = {
  id: number
  title: string
  body_html: string | null
  vendor: string | null
  product_type: string | null
  handle: string
  tags: string
  options?: { name: string; values: string[] }[]
  variants: PublicVariant[]
  image?: { src: string } | null
  images?: { src: string }[]
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

function parseTags(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function parseShopifyProductUrl(raw: string): {
  shopHost: string
  handle: string
  productUrl: string
  jsonUrl: string
} | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (!url.hostname || url.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
    return null
  }

  const m = url.pathname.match(/\/products\/([^/?#]+)/i)
  if (!m?.[1]) return null
  const handle = decodeURIComponent(m[1])
  const shopHost = url.hostname.toLowerCase()
  const productUrl = `https://${shopHost}/products/${handle}`
  return {
    shopHost,
    handle,
    productUrl,
    jsonUrl: `${productUrl}.json`,
  }
}

function selectedOptionsFromVariant(
  product: PublicProduct,
  variant: PublicVariant
): ShopifySelectedOption[] {
  const names = (product.options ?? []).map((o) => o.name)
  const values = [variant.option1, variant.option2, variant.option3]
  const out: ShopifySelectedOption[] = []
  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    if (!value) continue
    out.push({ name: names[i] ?? `Option ${i + 1}`, value })
  }
  return out
}

function looksLikeMenuOption(name: string): boolean {
  return /^(menu|item|food|dish|pizza|pasta|flavour|flavor|choice|add.?on)$/i.test(name.trim())
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

function extractThemeHints(html: string): SyncPreviewThemeHints {
  const day =
    html.match(/product__date-text-day[^>]*>[\s\S]*?<b>([^<]+)<\/b>/i)?.[1]?.trim() ??
    html.match(/product__date-text-day[^>]*>([^<]+)</i)?.[1]?.replace(/[^\w\s]/g, '').trim() ??
    null
  const time = html.match(/product__date-text-time[^>]*>([^<]+)</i)?.[1]?.trim() ?? null
  let location: string | null = null
  const locBlock = html.match(/product__location-text[\s\S]{0,800}?<\/div>/i)?.[0]
  if (locBlock) {
    location = stripHtml(locBlock)?.replace(/\s+/g, ' ').trim() ?? null
  }
  return {
    dateText: day,
    timeText: time,
    locationText: location,
    note:
      'Theme-rendered text found on the storefront HTML. Sync does not read this unless the same values exist as metafields/options (or offhrs.starts_at).',
  }
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'application/json, text/html;q=0.9,*/*;q=0.8',
        'User-Agent': USER_AGENT,
        ...(init?.headers ?? {}),
      },
    })
  } finally {
    clearTimeout(timeout)
  }
}

export async function analyzePublicShopifyProduct(
  inputUrl: string
): Promise<SyncPreviewResult | { error: string }> {
  const parsed = parseShopifyProductUrl(inputUrl)
  if (!parsed) {
    return {
      error:
        'Paste a full Shopify product URL, e.g. https://example.com/products/my-workshop',
    }
  }

  let productRes: Response
  try {
    productRes = await fetchWithTimeout(parsed.jsonUrl)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Could not reach product JSON (${msg}). Is the shop online?` }
  }

  if (!productRes.ok) {
    return {
      error: `Product JSON returned HTTP ${productRes.status}. Confirm the URL is a public Online Store product.`,
    }
  }

  let payload: { product?: PublicProduct }
  try {
    payload = (await productRes.json()) as { product?: PublicProduct }
  } catch {
    return { error: 'Response was not valid JSON — this may not be a Shopify Online Store product.' }
  }

  const product = payload.product
  if (!product?.id || !product.handle || !Array.isArray(product.variants)) {
    return { error: 'Unexpected product JSON shape.' }
  }

  const tags = parseTags(product.tags)
  const hasOffhrsTag = tags.some((t) => t.toLowerCase() === OFFHRS_WORKSHOP_TAG.toLowerCase())
  const optionNames = (product.options ?? []).map((o) => o.name)
  const menuLike = optionNames.some(looksLikeMenuOption)

  const sessions: SyncPreviewSession[] = product.variants.map((variant) => {
    const selectedOptions = selectedOptionsFromVariant(product, variant)
    const start = resolveShopifySessionStart({
      selectedOptions,
      variantTitle: variant.title,
      productTitle: product.title,
    })
    const bookUrl = `https://${parsed.shopHost}/products/${product.handle}?variant=${variant.id}`
    return {
      variantId: String(variant.id),
      variantTitle: variant.title,
      price: variant.price,
      available: typeof variant.available === 'boolean' ? variant.available : null,
      inventoryQuantity:
        typeof variant.inventory_quantity === 'number' ? variant.inventory_quantity : null,
      selectedOptions,
      start,
      wouldSync: Boolean(start.startsAt),
      bookUrl,
    }
  })

  const syncable = sessions.filter((s) => s.wouldSync)
  const skippedCount = sessions.length - syncable.length

  const uniqueStarts = new Set(syncable.map((s) => s.start.startsAt).filter(Boolean) as string[])
  const duplicateSameStart = syncable.length > 1 && uniqueStarts.size === 1

  const checks: SyncPreviewCheck[] = [
    {
      id: 'shopify_product',
      ok: true,
      label: 'Public Shopify product',
      detail: `Found product #${product.id} on ${parsed.shopHost}`,
    },
    {
      id: 'publish_channel',
      ok: false,
      label: 'Published to offhrs channel',
      detail:
        'Public scan cannot see channel publication. Use Connected deep scan (or publish the product to Sales channels → offhrs). Retail SKUs stay off the app unless published.',
    },
    {
      id: 'offhrs_tag',
      ok: hasOffhrsTag,
      label: `Legacy tag \`${OFFHRS_WORKSHOP_TAG}\``,
      detail: hasOffhrsTag
        ? 'Tag present (legacy path). Channel Sync prefers publish-to-offhrs over tags.'
        : `Optional for the sales channel. Prefer publishing to offhrs. Current tags: ${
            tags.length ? tags.join(', ') : '(none)'
          }.`,
    },
    {
      id: 'session_start',
      ok: syncable.length > 0,
      label: 'Parseable session start',
      detail:
        syncable.length > 0
          ? `${syncable.length} of ${sessions.length} variant(s) have a start Sync would accept (options / titles). Public JSON cannot see offhrs.starts_at metafields.`
          : 'No variant has a parseable Date/Time option or datetime in the title. Without offhrs.starts_at (Admin-only), Sync would skip this product.',
    },
  ]

  const warnings: string[] = []
  if (menuLike) {
    warnings.push(
      `Option "${optionNames.find(looksLikeMenuOption)}" looks like a menu/choice, not session times. Sync treats each variant as a session — guests would not see menu labels on offhrs.`
    )
  }
  if (duplicateSameStart) {
    warnings.push(
      `All syncable variants share the same start (${formatTorontoLabel(
        [...uniqueStarts][0]!
      )}). Guests would see duplicate identical time pills unless you use one listing per product.`
    )
  }
  if (sessions.length > 1 && syncable.length === 0 && menuLike) {
    warnings.push(
      'With a product-level offhrs.starts_at metafield, Sync would currently create one session per menu variant (same time). Prefer a single “ticket” variant or a product-level listing mode.'
    )
  }
  if (product.variants.some((v) => v.inventory_quantity == null)) {
    warnings.push(
      'Inventory quantity is not exposed (or not tracked) on some variants in public JSON — seat counts may be incomplete until Admin API sync.'
    )
  }

  let themeHints: SyncPreviewThemeHints | null = null
  try {
    const htmlRes = await fetchWithTimeout(parsed.productUrl, {
      headers: { Accept: 'text/html' },
    })
    if (htmlRes.ok) {
      const html = await htmlRes.text()
      const hints = extractThemeHints(html)
      if (hints.dateText || hints.timeText || hints.locationText) {
        themeHints = hints
        warnings.push(
          'Storefront theme shows date/time/location that are not in product JSON. Ask the vendor which metafields power those fields, or have them set offhrs.starts_at.'
        )
      }
    }
  } catch {
    /* theme scrape is best-effort */
  }

  const limitations = [
    'Public preview cannot read Shopify Admin metafields (offhrs.starts_at, book_url, capacity, category) or channel publication.',
    'Sales channel Sync lists products published to offhrs that have a parseable session datetime — not the whole catalog.',
    'Location on synced listings comes from the partner profile address, not the product page.',
    'This does not write to the database — demo only.',
  ]

  let verdict: SyncPreviewVerdict = 'needs_setup'
  let summary: string
  if (syncable.length > 0) {
    verdict = 'needs_setup'
    summary = `Start times look syncable for ${syncable.length} variant(s). Confirm the product is published to Sales channels → offhrs (use Connected deep scan) before it can appear in the app.`
  } else {
    verdict = 'blocked'
    summary =
      'No parseable session start in public JSON — set a Date option like “September 30, 2026 12:00 PM” or offhrs.starts_at (Admin). Without a datetime, Sync skips the product even if published.'
  }

  const imageUrl = product.image?.src ?? product.images?.[0]?.src ?? null
  const description = stripHtml(product.body_html)
  const firstPrice = syncable[0]?.price ?? product.variants[0]?.price ?? null
  const priceCad = firstPrice != null ? Number.parseFloat(firstPrice) : null
  const priceLabel =
    firstPrice != null
      ? syncable.length > 1 && syncable[0]?.price !== product.variants[0]?.price
        ? `From $${firstPrice}`
        : `$${firstPrice}`
      : null

  const sessionTimes = syncable
    .map((s) => (s.start.startsAt ? formatTorontoLabel(s.start.startsAt) : null))
    .filter((x): x is string => Boolean(x))
  const uniqueStartList = [...uniqueStarts]
  const isMultipleDates = uniqueStartList.length > 1
  const earliestIso = uniqueStartList.slice().sort()[0] as string | undefined
  const earliestDateLabel = earliestIso
    ? new Date(earliestIso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Toronto',
      })
    : null

  const wouldAppearOnApp = false
  const appearanceNote =
    syncable.length === 0
      ? 'Would not appear — no parseable session datetime.'
      : 'Would not appear yet from public data alone — product must be published to the offhrs channel and Sync must run (use Connected deep scan for a full verdict).'

  const demo: SyncPreviewDemoCard = {
    title: product.title,
    description,
    imageUrl,
    organizer: product.vendor,
    locationNote:
      'Location would use the partner profile address after signup (not scraped from this product page).',
    locationLabel: 'Location TBD',
    priceLabel,
    priceCad: Number.isFinite(priceCad) ? priceCad : null,
    bookUrl: syncable[0]?.bookUrl ?? parsed.productUrl,
    sessionTimes,
    sessionCount: syncable.length,
    category: product.product_type?.trim() || 'Workshop',
    earliestDateLabel,
    isMultipleDates,
    wouldAppearOnApp,
    appearanceNote,
    bookingCta: 'Book',
  }

  return {
    verdict,
    summary,
    inputUrl: inputUrl.trim(),
    shopHost: parsed.shopHost,
    productUrl: parsed.productUrl,
    handle: product.handle,
    product: {
      id: product.id,
      title: product.title,
      vendor: product.vendor,
      productType: product.product_type,
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
    themeHints,
    limitations,
  }
}
