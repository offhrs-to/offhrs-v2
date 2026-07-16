import { haversineKm } from '@/lib/distance';
import { compareWorkshopEventsByStart, workshopEventTorontoYmd } from '@/lib/workshop-event-sort';
import { getTorontoYmd } from '@/lib/workshop-calendar';
import type { WorkshopEventRow } from '@/lib/workshops-events-query';
import { sortWorkshopGroupsByPrice, type WorkshopPriceSort } from '@/lib/workshop-price-sort';

export type BrowseListSort = 'time' | 'distance';

export type BrowseDistanceKm = 'auto' | 1 | 2 | 5 | 10 | 20;

export const BROWSE_DISTANCE_OPTIONS: { value: BrowseDistanceKm; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 1, label: '1 km' },
  { value: 2, label: '2 km' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 20, label: '20 km' },
];

export function groupDistanceKm(
  group: WorkshopEventRow[],
  anchor: { lat: number; lng: number } | null
): number | null {
  if (!anchor) return null;
  let best: number | null = null;
  for (const e of group) {
    if (e.lat == null || e.lng == null) continue;
    const km = haversineKm(anchor.lat, anchor.lng, Number(e.lat), Number(e.lng));
    if (!Number.isFinite(km)) continue;
    if (best == null || km < best) best = km;
  }
  return best;
}

export function filterGroupsByDistanceRadius(
  groups: WorkshopEventRow[][],
  radiusKm: BrowseDistanceKm,
  anchor: { lat: number; lng: number } | null
): WorkshopEventRow[][] {
  if (radiusKm === 'auto') return groups;
  if (!anchor) return groups;
  return groups.filter((g) => {
    const km = groupDistanceKm(g, anchor);
    return km != null && km <= radiusKm;
  });
}

/** True when the event's Toronto calendar day falls in [startYmd, endYmd] (inclusive). */
export function eventMatchesYmdRange(
  e: WorkshopEventRow,
  startYmd: string | null,
  endYmd: string | null
): boolean {
  if (!startYmd && !endYmd) return true;
  if (e.recurrence === 'daily' || e.recurrence === 'weekly') return true;
  const ymd = workshopEventTorontoYmd(e);
  if (!ymd) return false;
  if (startYmd && ymd < startYmd) return false;
  if (endYmd && ymd > endYmd) return false;
  return true;
}

export function sortWorkshopGroupsForBrowse(
  groups: WorkshopEventRow[][],
  listSort: BrowseListSort,
  priceSort: WorkshopPriceSort,
  anchor: { lat: number; lng: number } | null
): WorkshopEventRow[][] {
  // Price sort takes precedence when explicitly set (All Filters).
  if (priceSort !== 'default') {
    return sortWorkshopGroupsByPrice(groups, priceSort);
  }

  const sorted = [...groups];
  if (listSort === 'distance' && anchor) {
    sorted.sort((a, b) => {
      const da = groupDistanceKm(a, anchor);
      const db = groupDistanceKm(b, anchor);
      if (da == null && db == null) return compareWorkshopEventsByStart(a[0]!, b[0]!);
      if (da == null) return 1;
      if (db == null) return -1;
      if (da !== db) return da - db;
      return compareWorkshopEventsByStart(a[0]!, b[0]!);
    });
    return sorted;
  }

  // Time: closest to current moment / soonest first.
  sorted.sort((a, b) => compareWorkshopEventsByStart(a[0]!, b[0]!));
  return sorted;
}

export function browseFiltersAreActive(opts: {
  selectedCategories: string[];
  listSort: BrowseListSort;
  distanceKm: BrowseDistanceKm;
  priceSort: WorkshopPriceSort;
  selectedYmd: string | null;
  rangeStart: string | null;
  rangeEnd: string | null;
}): boolean {
  return (
    opts.selectedCategories.length > 0 ||
    opts.listSort !== 'time' ||
    opts.distanceKm !== 'auto' ||
    opts.priceSort !== 'default' ||
    opts.selectedYmd != null ||
    opts.rangeStart != null ||
    opts.rangeEnd != null
  );
}

export function categoryPillLabel(selectedCategories: string[]): string {
  if (selectedCategories.length === 0) return 'Category';
  if (selectedCategories.length === 1) {
    const c = selectedCategories[0]!;
    if (c.length > 12) return `${c.slice(0, 11)}…`;
    return c;
  }
  return `${selectedCategories.length} categories`;
}

/** Parse `categories` query param (comma-separated) into known category names. */
export function parseCategoriesParam(raw: string, allowed: readonly string[]): string[] {
  if (!raw.trim()) return [];
  const allow = new Set(allowed);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const c = part.trim();
    if (!c || !allow.has(c) || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/** Stable serialize for URL params; empty → null (all categories). */
export function serializeCategoriesParam(selected: string[], allowed: readonly string[]): string | null {
  if (selected.length === 0) return null;
  const ordered = allowed.filter((c) => selected.includes(c));
  return ordered.length > 0 ? ordered.join(',') : null;
}

export function sortPillLabel(listSort: BrowseListSort, priceSort: WorkshopPriceSort): string {
  if (priceSort === 'price_high') return 'Price ↓';
  if (priceSort === 'price_low') return 'Price ↑';
  if (listSort === 'distance') return 'Distance';
  return 'Sort';
}

export function distancePillLabel(distanceKm: BrowseDistanceKm): string {
  if (distanceKm === 'auto') return 'Distance';
  return `${distanceKm} km`;
}

/** Clear single-day strip selection when applying a multi-day range. */
export function normalizeCalendarSelection(
  start: string | null,
  end: string | null
): { selectedYmd: string | null; rangeStart: string | null; rangeEnd: string | null } {
  if (!start && !end) {
    return { selectedYmd: null, rangeStart: null, rangeEnd: null };
  }
  if (start && end && start === end) {
    return { selectedYmd: start, rangeStart: null, rangeEnd: null };
  }
  if (start && !end) {
    return { selectedYmd: start, rangeStart: null, rangeEnd: null };
  }
  if (!start && end) {
    return { selectedYmd: end, rangeStart: null, rangeEnd: null };
  }
  const s = start! <= end! ? start! : end!;
  const e = start! <= end! ? end! : start!;
  return { selectedYmd: null, rangeStart: s, rangeEnd: e };
}

export function todayYmd(): string {
  return getTorontoYmd();
}
