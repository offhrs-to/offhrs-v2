/** Artist Marketplace product categories (partner catalog + Shop browse). */
export const SHOP_CATEGORIES = [
  'Ceramics',
  'Prints & Paintings',
  'Jewelry & Metalwork',
  'Textiles',
  'Sculpture',
  'Home & Lifestyle',
  'Other',
] as const

export type ShopCategory = (typeof SHOP_CATEGORIES)[number]

export const SHOP_CATEGORY_ENUM = SHOP_CATEGORIES as unknown as [ShopCategory, ...ShopCategory[]]

/** Map pre-launch labels → current taxonomy. */
const LEGACY_SHOP_CATEGORY: Record<string, ShopCategory> = {
  Pottery: 'Ceramics',
  Ceramics: 'Ceramics',
  Prints: 'Prints & Paintings',
  'Prints & Paintings': 'Prints & Paintings',
  Jewelry: 'Jewelry & Metalwork',
  'Jewelry & Metalwork': 'Jewelry & Metalwork',
  Textiles: 'Textiles',
  Sculpture: 'Sculpture',
  Home: 'Home & Lifestyle',
  'Home & Lifestyle': 'Home & Lifestyle',
  Other: 'Other',
}

export function normalizeShopCategory(raw: string | null | undefined): ShopCategory {
  if (!raw?.trim()) return 'Other'
  const t = raw.trim()
  if ((SHOP_CATEGORIES as readonly string[]).includes(t)) return t as ShopCategory
  return LEGACY_SHOP_CATEGORY[t] ?? 'Other'
}
