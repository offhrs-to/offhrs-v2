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
  'Textiles',
  'Music',
  'Wellness',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]
