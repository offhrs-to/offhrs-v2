/**
 * Shared category list for Home and Workshops pages.
 * Matches web app categories.
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

/** Map retired / legacy category labels to the current canonical name. */
export function normalizeCategoryLabel(raw: string | null | undefined): string {
  const t = typeof raw === 'string' ? raw.trim() : ''
  if (!t) return ''
  if (t === 'Beauty & Fragrance') return 'Scent & Candle'
  return t
}
