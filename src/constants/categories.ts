/**
 * Shared category list for Home and Workshops pages.
 * Single source of truth across web and mobile apps.
 */
export const CATEGORIES = [
  'Scent & Candle',
  'Culinary',
  'Coffee',
  'Floral',
  'Pottery',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]

/** Zod-friendly tuple: first element + rest (same order as CATEGORIES). */
export const CATEGORY_ENUM = CATEGORIES as unknown as [Category, ...Category[]]

/** Legacy partner session slugs / retired labels → canonical display names. */
const LEGACY_CATEGORY_BY_SLUG: Record<string, Category> = {
  pottery: 'Pottery',
  floral: 'Floral',
  culinary: 'Culinary',
  other: 'Other',
  /** Renamed Jul 2026 — keep reading old DB/form values. */
  'beauty & fragrance': 'Scent & Candle',
  'beauty-fragrance': 'Scent & Candle',
}

/** Normalize DB or form values for partner UI (legacy slugs or current labels). */
export function normalizePartnerSessionCategory(raw: string | null | undefined): Category {
  if (!raw?.trim()) return 'Other'
  const t = raw.trim()
  if ((CATEGORIES as readonly string[]).includes(t)) return t as Category
  if (t === 'Beauty & Fragrance') return 'Scent & Candle'
  return LEGACY_CATEGORY_BY_SLUG[t.toLowerCase()] ?? 'Other'
}

/** Novice tier icon per category (same assets as mobile app / landing). */
export const CATEGORY_NOVICE_ICONS: Record<string, string> = {
  'Scent & Candle': '/categories/beauty-fragrance-novice.png',
  /** Legacy key until all callers use the new label. */
  'Beauty & Fragrance': '/categories/beauty-fragrance-novice.png',
  Culinary: '/categories/culinary-novice.png',
  Coffee: '/categories/coffee-novice.png',
  Floral: '/categories/floral-novice.png',
  Pottery: '/categories/pottery-novice.png',
  Other: '/categories/other-novice.png',
}

export const DEFAULT_CATEGORY_NOVICE_ICON = '/categories/other-novice.png'

/** Resolve public path for the category Novice illustration (fallback when event image is missing or broken). */
export function getCategoryNoviceIconPath(category: string | null | undefined): string {
  if (!category?.trim()) return DEFAULT_CATEGORY_NOVICE_ICON
  const t = normalizePartnerSessionCategory(category)
  return CATEGORY_NOVICE_ICONS[t] ?? DEFAULT_CATEGORY_NOVICE_ICON
}
