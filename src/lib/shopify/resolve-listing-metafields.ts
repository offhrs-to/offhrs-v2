/**
 * Resolve workshop listing fields from Shopify product/variant metafields.
 * Prefers offhrs.* then common merchant keys (Depanneur-style Date / location / capacity).
 */

import {
  OFFHRS_METAFIELD_CAPACITY,
  OFFHRS_METAFIELD_CATEGORY,
  OFFHRS_METAFIELD_DURATION,
  OFFHRS_METAFIELD_NAMESPACE,
  OFFHRS_METAFIELD_STARTS_AT,
} from './conventions'
import { parseShopifyWallDateTime } from './parse-session-start'

export type ListingMetafield = {
  namespace: string
  key: string
  value: string
}

export type ResolvedListingMetafields = {
  /** Raw start string that parsed (or null) */
  startsAtRaw: string | null
  /** Parsed ISO UTC when startsAtRaw parses */
  startsAtIso: string | null
  matchedStartKey: string | null
  location: string | null
  capacity: number | null
  durationMinutes: number | null
  category: string | null
}

const START_KEY_RE = /^(starts?_?at|date|event_?date|session_?date|when)$/i
const LOCATION_KEY_RE = /^(location|venue|address|place)$/i
const CAPACITY_KEY_RE = /^(capacity|event_?capacity|seats|max_?(attendees|guests))$/i
const DURATION_KEY_RE = /^(duration|duration_minutes|length)$/i

function normalizeKey(key: string): string {
  return key.trim().replace(/\s+/g, '_').toLowerCase()
}

function pickFirst(
  fields: ListingMetafield[],
  pred: (m: ListingMetafield) => boolean
): ListingMetafield | null {
  for (const m of fields) {
    if (pred(m) && m.value?.trim()) return m
  }
  return null
}

function parsePositiveInt(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null
  const n = Number.parseInt(raw.trim().replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Flatten GraphQL metafield edges into listing metafields.
 * Variant list should be passed after product so later entries can override when we merge.
 */
export function flattenMetafieldEdges(
  edges: Array<{ node: { namespace?: string; key: string; value: string } }> | undefined,
  defaultNamespace = ''
): ListingMetafield[] {
  return (edges ?? [])
    .map((e) => ({
      namespace: (e.node.namespace ?? defaultNamespace).trim(),
      key: e.node.key?.trim() ?? '',
      value: e.node.value ?? '',
    }))
    .filter((m) => m.key)
}

/**
 * Resolve listing fields. Pass product metafields first, then variant (variant wins for start/capacity).
 */
export function resolveListingMetafields(
  productFields: ListingMetafield[],
  variantFields: ListingMetafield[] = []
): ResolvedListingMetafields {
  // Variant last so it overrides product for the same logical field when scanning in reverse.
  const merged = [...productFields, ...variantFields]

  const offhrsStart = pickFirst(
    [...variantFields, ...productFields],
    (m) =>
      m.namespace === OFFHRS_METAFIELD_NAMESPACE && m.key === OFFHRS_METAFIELD_STARTS_AT
  )
  const heuristicStart = pickFirst([...variantFields, ...productFields], (m) =>
    START_KEY_RE.test(normalizeKey(m.key))
  )
  // Also accept any metafield whose value parses as a wall datetime when key looks date-ish
  // (already covered by START_KEY_RE). Prefer offhrs then heuristic.
  const startField = offhrsStart ?? heuristicStart
  let startsAtRaw: string | null = null
  let startsAtIso: string | null = null
  let matchedStartKey: string | null = null
  if (startField) {
    const iso = parseShopifyWallDateTime(startField.value)
    if (iso) {
      startsAtRaw = startField.value.trim()
      startsAtIso = iso
      matchedStartKey = `${startField.namespace}.${startField.key}`.replace(/^\./, '')
    }
  }

  // If named keys didn't parse, scan remaining fields for a parseable datetime value
  // only on start-like keys we already checked — avoid grabbing random text.
  if (!startsAtIso) {
    for (const m of [...variantFields, ...productFields]) {
      if (!START_KEY_RE.test(normalizeKey(m.key))) continue
      const iso = parseShopifyWallDateTime(m.value)
      if (iso) {
        startsAtRaw = m.value.trim()
        startsAtIso = iso
        matchedStartKey = `${m.namespace}.${m.key}`.replace(/^\./, '')
        break
      }
    }
  }

  const offhrsLocation = pickFirst(
    [...variantFields, ...productFields],
    (m) => m.namespace === OFFHRS_METAFIELD_NAMESPACE && /^location$/i.test(m.key)
  )
  const heuristicLocation = pickFirst([...variantFields, ...productFields], (m) =>
    LOCATION_KEY_RE.test(normalizeKey(m.key))
  )
  const locationField = offhrsLocation ?? heuristicLocation
  const location = locationField?.value.trim() || null

  const offhrsCapacity = pickFirst(
    [...variantFields, ...productFields],
    (m) => m.namespace === OFFHRS_METAFIELD_NAMESPACE && m.key === OFFHRS_METAFIELD_CAPACITY
  )
  const heuristicCapacity = pickFirst([...variantFields, ...productFields], (m) =>
    CAPACITY_KEY_RE.test(normalizeKey(m.key))
  )
  const capacity = parsePositiveInt((offhrsCapacity ?? heuristicCapacity)?.value)

  const offhrsDuration = pickFirst(
    [...variantFields, ...productFields],
    (m) => m.namespace === OFFHRS_METAFIELD_NAMESPACE && m.key === OFFHRS_METAFIELD_DURATION
  )
  const heuristicDuration = pickFirst([...variantFields, ...productFields], (m) =>
    DURATION_KEY_RE.test(normalizeKey(m.key))
  )
  const durationMinutes = parsePositiveInt((offhrsDuration ?? heuristicDuration)?.value)

  const offhrsCategory = pickFirst(
    [...variantFields, ...productFields],
    (m) => m.namespace === OFFHRS_METAFIELD_NAMESPACE && m.key === OFFHRS_METAFIELD_CATEGORY
  )
  const category = offhrsCategory?.value.trim() || null

  void merged // reserved for future diagnostics

  return {
    startsAtRaw,
    startsAtIso,
    matchedStartKey,
    location,
    capacity,
    durationMinutes,
    category,
  }
}
