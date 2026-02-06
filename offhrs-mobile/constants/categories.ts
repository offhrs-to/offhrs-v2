/**
 * Shared category list for Home and Workshops pages.
 * Matches web app categories.
 */
export const CATEGORIES = [
  'Beauty & Fragrance',
  'Culinary',
  'Coffee',
  'Floral',
  'Pottery',
  'Music',
  'Wellness',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]
