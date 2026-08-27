/** Artist Marketplace product categories (partner catalog + future Shop browse). */
export const SHOP_CATEGORIES = [
  'Pottery',
  'Prints',
  'Jewelry',
  'Textiles',
  'Home',
  'Sculpture',
  'Other',
] as const

export type ShopCategory = (typeof SHOP_CATEGORIES)[number]

export const SHOP_CATEGORY_ENUM = SHOP_CATEGORIES as unknown as [ShopCategory, ...ShopCategory[]]

export function normalizeShopCategory(raw: string | null | undefined): ShopCategory {
  if (!raw?.trim()) return 'Other'
  const t = raw.trim()
  if ((SHOP_CATEGORIES as readonly string[]).includes(t)) return t as ShopCategory
  return 'Other'
}
