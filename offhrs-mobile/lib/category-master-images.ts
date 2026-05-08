/**
 * Master-tier category artwork for grids and vendor placeholders (no event image).
 */
export function getCategoryMasterImageSource(category: string | null | undefined): number {
  const c = category ?? '';
  switch (c) {
    case 'Beauty & Fragrance':
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

