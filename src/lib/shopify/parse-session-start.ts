import { isValid, parse } from 'date-fns'
import { TZDate } from '@date-fns/tz'
import { parseWorkshopDateTimeInput, WORKSHOP_TIMEZONE } from '@/lib/workshop-timezone'

export type ShopifySelectedOption = { name: string; value: string }

/** Option names that usually hold the session datetime (Orris-style "Date" pills). */
const DATETIME_OPTION_NAME_RE =
  /^(date|dates|date\s*&\s*time|datetime|date\s*\/\s*time|time|timeslot|time\s*slot|session|session\s*date|when|schedule|start|starts?|aug\.?\s*\d{1,2}|sep\.?\s*\d{1,2}|oct\.?\s*\d{1,2}|nov\.?\s*\d{1,2}|dec\.?\s*\d{1,2}|jan\.?\s*\d{1,2}|feb\.?\s*\d{1,2}|mar\.?\s*\d{1,2}|apr\.?\s*\d{1,2}|may\.?\s*\d{1,2}|jun\.?\s*\d{1,2}|jul\.?\s*\d{1,2})$/i

/** Option names that are almost never a start time (skip when scanning all options). */
const NON_DATETIME_OPTION_NAME_RE =
  /^(ticket|tickets|title|size|color|colour|style|material|guest|guests|party|quantity|qty|type|location|studio|addon|add-on|menu)$/i

/**
 * Formats seen on Shopify workshop variants (America/Toronto wall time).
 * Orris Labs example: "August 21, 2026 12:00 PM"
 */
const WALL_TIME_FORMATS = [
  'MMMM d, yyyy h:mm a',
  'MMMM d, yyyy hh:mm a',
  'MMM d, yyyy h:mm a',
  'MMM d, yyyy hh:mm a',
  'MMMM d yyyy h:mm a',
  'MMM d yyyy h:mm a',
  'MMMM d, yyyy H:mm',
  'MMMM d yyyy H:mm',
  'MMM d, yyyy H:mm',
  'MMM d yyyy H:mm',
  'MMMM d, yyyy h:mm',
  'MMMM d yyyy h:mm',
  'yyyy-MM-dd h:mm a',
  'yyyy-MM-dd hh:mm a',
  'yyyy-MM-dd H:mm',
  'yyyy-MM-dd HH:mm',
  'M/d/yyyy h:mm a',
  'M/d/yyyy H:mm',
  'd MMMM yyyy h:mm a',
  'd MMM yyyy h:mm a',
] as const

function stripOrdinals(s: string): string {
  return s.replace(/\b(\d+)(st|nd|rd|th)\b/gi, '$1')
}

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function torontoFromParts(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  second = 0
): Date | null {
  const tz = new TZDate(year, monthIndex, day, hour, minute, second, WORKSHOP_TIMEZONE)
  const ms = tz.getTime()
  return Number.isNaN(ms) ? null : new Date(ms)
}

/**
 * Parse a human / ISO datetime string as America/Toronto wall time when no offset is present.
 * Returns ISO UTC string or null.
 */
export function parseShopifyWallDateTime(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  let s = normalizeSpaces(stripOrdinals(raw))
  s = s.replace(/\s+at\s+/i, ' ')

  // ISO / partner datetime-local
  const withT = s.includes('T') ? s : s.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/, '$1T$2')
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(withT) || /[zZ]|[+-]\d{2}:\d{2}$/.test(s)) {
    const d = parseWorkshopDateTimeInput(withT)
    if (d) return d.toISOString()
  }

  const ref = new Date(2020, 0, 1, 12, 0, 0)
  for (const fmt of WALL_TIME_FORMATS) {
    const parsed = parse(s, fmt, ref)
    if (!isValid(parsed)) continue
    if (parsed.getFullYear() < 2020 || parsed.getFullYear() > 2100) continue
    const instant = torontoFromParts(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate(),
      parsed.getHours(),
      parsed.getMinutes(),
      parsed.getSeconds()
    )
    if (instant) return instant.toISOString()
  }

  return null
}

function looksLikeDateTimeText(value: string): boolean {
  const v = value.trim()
  if (v.length < 8 || v.length > 120) return false
  if (!/\d{4}|\d{1,2}:\d{2}/.test(v)) return false
  const hasMonth = /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(v)
  const hasNumericDate = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v)
  const hasTime = /\d{1,2}:\d{2}\s*(am|pm)?/i.test(v) || /T\d{2}:\d{2}/.test(v)
  return hasTime && (hasMonth || hasNumericDate)
}

export type SessionStartSource =
  | 'metafield'
  | 'option'
  | 'variant_title'
  | 'product_title'
  | null

export type ResolveSessionStartResult = {
  startsAt: string | null
  source: SessionStartSource
  matchedOptionName?: string
  matchedRaw?: string
}

/**
 * Resolve workshop start for a Shopify variant.
 * Priority:
 * 1. offhrs.starts_at metafield (explicit override)
 * 2. selectedOptions with Date/Time-like names (Orris "Date" pills)
 * 3. Any option value that parses as a datetime
 * 4. Variant title (when not Default Title)
 * 5. Product title only if it clearly includes a time
 */
export function resolveShopifySessionStart(opts: {
  metafieldStartsAt?: string | null
  selectedOptions?: ShopifySelectedOption[] | null
  variantTitle?: string | null
  productTitle?: string | null
}): ResolveSessionStartResult {
  const meta = opts.metafieldStartsAt?.trim()
  if (meta) {
    const startsAt = parseShopifyWallDateTime(meta)
    if (startsAt) return { startsAt, source: 'metafield', matchedRaw: meta }
  }

  const options = opts.selectedOptions ?? []

  const namedDateOptions = options.filter((o) => DATETIME_OPTION_NAME_RE.test(o.name.trim()))
  for (const o of namedDateOptions) {
    const startsAt = parseShopifyWallDateTime(o.value)
    if (startsAt) {
      return { startsAt, source: 'option', matchedOptionName: o.name, matchedRaw: o.value }
    }
  }

  for (const o of options) {
    if (NON_DATETIME_OPTION_NAME_RE.test(o.name.trim())) continue
    if (namedDateOptions.some((d) => d.name === o.name && d.value === o.value)) continue
    if (!looksLikeDateTimeText(o.value)) continue
    const startsAt = parseShopifyWallDateTime(o.value)
    if (startsAt) {
      return { startsAt, source: 'option', matchedOptionName: o.name, matchedRaw: o.value }
    }
  }

  const variantTitle = opts.variantTitle?.trim()
  if (variantTitle && variantTitle !== 'Default Title') {
    const firstSegment = variantTitle.split(/\s*\/\s*/)[0]?.trim() ?? variantTitle
    for (const candidate of [firstSegment, variantTitle]) {
      const startsAt = parseShopifyWallDateTime(candidate)
      if (startsAt) return { startsAt, source: 'variant_title', matchedRaw: candidate }
    }
  }

  const productTitle = opts.productTitle?.trim()
  if (productTitle && looksLikeDateTimeText(productTitle)) {
    const startsAt = parseShopifyWallDateTime(productTitle)
    if (startsAt) return { startsAt, source: 'product_title', matchedRaw: productTitle }
  }

  return { startsAt: null, source: null }
}
