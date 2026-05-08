/** Stable bucket for events with no category so at most one “uncategorized” card appears when diversifying. */
export function categoryKey(category: string | null | undefined): string {
  const t = typeof category === 'string' ? category.trim() : '';
  return t.length > 0 ? t : '__uncategorized__';
}

/**
 * Walks `sorted` in order and keeps up to `n` rows whose categories have not been seen yet.
 * Preserves sort priority (e.g. soonest first or closest first).
 */
export function pickFirstNUniqueCategory<T extends { category: string | null; id: number }>(
  sorted: T[],
  n: number
): T[] {
  const usedCat = new Set<string>();
  const usedId = new Set<number>();
  const out: T[] = [];
  for (const row of sorted) {
    if (usedId.has(row.id)) continue;
    const k = categoryKey(row.category);
    if (usedCat.has(k)) continue;
    usedCat.add(k);
    usedId.add(row.id);
    out.push(row);
    if (out.length >= n) break;
  }
  return out;
}

