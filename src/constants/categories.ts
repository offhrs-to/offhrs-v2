/**
 * Shared category list for Home and Workshops pages.
 * Single source of truth across web and mobile apps.
 */
export const CATEGORIES = [
  'Beauty & Fragrance',
  'Culinary',
  'Coffee',
  'Floral',
  'Pottery',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]

/** Novice tier icon per category (same assets as mobile app / landing). */
export const CATEGORY_NOVICE_ICONS: Record<string, string> = {
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
  const t = category.trim()
  return CATEGORY_NOVICE_ICONS[t] ?? DEFAULT_CATEGORY_NOVICE_ICON
}
