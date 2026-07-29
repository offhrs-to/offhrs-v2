/**
 * Master-tier category artwork for grids and vendor placeholders (no event image).
 */
export function getCategoryMasterImageSource(category: string | null | undefined): number {
  const c = category ?? '';
  switch (c) {
    case 'Scent & Candle':
    case 'Beauty & Fragrance': // legacy DB label
      return require('@/assets/images/beauty-fragrance-master.png');
    case 'Culinary':
      return require('@/assets/images/culinary-master.png');
    case 'Coffee':
      return require('@/assets/images/coffee-master.png');
    case 'Floral':
      return require('@/assets/images/floral-master.png');
    case 'Pottery':
      return require('@/assets/images/pottery-master.png');
    case 'Other':
    default:
      return require('@/assets/images/other-master.png');
  }
}

/**
 * Photo tiles for the Workshops “What sparks your curiosity?” category grid.
 * Separate from master line-art so skill badges / event fallbacks stay unchanged.
 */
export function getCategoryTileImageSource(category: string | null | undefined): number {
  const c = category ?? '';
  switch (c) {
    case 'Scent & Candle':
    case 'Beauty & Fragrance':
      return require('@/assets/images/category-tile-scent-candle.png');
    case 'Culinary':
      return require('@/assets/images/category-tile-culinary.png');
    case 'Coffee':
      return require('@/assets/images/category-tile-coffee.png');
    case 'Floral':
      return require('@/assets/images/category-tile-floral.png');
    case 'Pottery':
      return require('@/assets/images/category-tile-pottery.png');
    case 'Other':
    default:
      return require('@/assets/images/category-tile-other.png');
  }
}

