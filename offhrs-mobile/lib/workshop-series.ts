/** Keep in sync with src/lib/workshop-series.ts (consumer-facing subset). */

export type SeriesOccurrence = {
  start: string;
  max_attendees: number;
  available_slots: number;
  registration_closed?: boolean;
  /** Optional per-session overrides (missing = inherit parent workshop). */
  title?: string;
  duration_minutes?: number;
  location?: string;
  lat?: number;
  lng?: number;
  price_cad?: number;
  sale_price_cad?: number | null;
};

export type EventSeriesFields = {
  workshop_series?: string | null;
  series_occurrences?: unknown;
  date?: string | null;
  max_attendees?: number | null;
  available_slots?: number | null;
  partner_series_meta?: unknown;
};

export type SeriesMode = 'cohort' | 'per_occurrence';

export function getSeriesMode(row: EventSeriesFields): SeriesMode {
  const meta = row.partner_series_meta as { pattern?: string } | null | undefined;
  const pattern = meta?.pattern;
  if (pattern === 'weekly_same' || pattern === 'weekly_custom') return 'cohort';
  return 'per_occurrence';
}

export function applyCohortAvailability(
  occ: SeriesOccurrence[],
  maxAttendees: number,
  availableSlots: number
): SeriesOccurrence[] {
  return occ.map((o) => ({
    ...o,
    max_attendees: maxAttendees,
    available_slots: availableSlots,
  }));
}

/** Read optional per-session override fields from raw JSON. */
export function pickSeriesOccurrenceOverrides(
  o: Record<string, unknown>
): Partial<
  Pick<
    SeriesOccurrence,
    'title' | 'duration_minutes' | 'location' | 'lat' | 'lng' | 'price_cad' | 'sale_price_cad'
  >
> {
  const out: Partial<SeriesOccurrence> = {};
  if (typeof o.title === 'string' && o.title.trim()) {
    out.title = o.title.trim().slice(0, 120);
  }
  const duration = Number(o.duration_minutes);
  if (Number.isFinite(duration) && duration >= 15 && duration <= 480) {
    out.duration_minutes = Math.floor(duration);
  }
  if (typeof o.location === 'string' && o.location.trim()) {
    out.location = o.location.trim().slice(0, 500);
  }
  const lat = Number(o.lat);
  const lng = Number(o.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    out.lat = lat;
    out.lng = lng;
  }
  if (o.price_cad != null && o.price_cad !== '') {
    const price = Number(o.price_cad);
    if (Number.isFinite(price) && price >= 0 && price <= 10000) {
      out.price_cad = Math.round(price * 100) / 100;
      if (o.sale_price_cad === null) {
        out.sale_price_cad = null;
      } else if (o.sale_price_cad != null && o.sale_price_cad !== '') {
        const sale = Number(o.sale_price_cad);
        if (Number.isFinite(sale) && sale >= 0 && sale < out.price_cad) {
          out.sale_price_cad = Math.round(sale * 100) / 100;
        } else {
          out.sale_price_cad = null;
        }
      } else {
        out.sale_price_cad = null;
      }
    }
  }
  return out;
}

export function parseSeriesOccurrences(row: EventSeriesFields): SeriesOccurrence[] {
  if (row.workshop_series !== 'multi_week') return [];
  const raw = row.series_occurrences;
  if (!Array.isArray(raw)) return [];
  const out: SeriesOccurrence[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const start = typeof o.start === 'string' ? o.start : '';
    const max = Number(o.max_attendees);
    const avail = Number(o.available_slots);
    if (start && Number.isFinite(max) && Number.isFinite(avail)) {
      const registration_closed = o.registration_closed === true;
      const overrides = pickSeriesOccurrenceOverrides(o);
      out.push({
        start,
        max_attendees: max,
        available_slots: avail,
        ...(registration_closed ? { registration_closed: true } : {}),
        ...overrides,
      });
    }
  }
  out.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return out;
}

/**
 * Resolve listing/checkout fields for one series occurrence (inherit parent when unset).
 */
export function resolveOccurrenceListingFields<
  T extends {
    title?: string | null;
    duration_minutes?: number | null;
    location?: string | null;
    lat?: number | null;
    lng?: number | null;
    price_cad?: number | null;
    sale_price_cad?: number | null;
    sale_starts_on?: string | null;
    sale_ends_on?: string | null;
  },
>(
  parent: T,
  occ: SeriesOccurrence | null | undefined
): {
  title: string | null | undefined;
  duration_minutes: number | null | undefined;
  location: string | null | undefined;
  lat: number | null | undefined;
  lng: number | null | undefined;
  price_cad: number | null | undefined;
  sale_price_cad: number | null | undefined;
  sale_starts_on: string | null | undefined;
  sale_ends_on: string | null | undefined;
} {
  if (!occ) {
    return {
      title: parent.title,
      duration_minutes: parent.duration_minutes,
      location: parent.location,
      lat: parent.lat,
      lng: parent.lng,
      price_cad: parent.price_cad,
      sale_price_cad: parent.sale_price_cad,
      sale_starts_on: parent.sale_starts_on,
      sale_ends_on: parent.sale_ends_on,
    };
  }
  const hasPriceOverride = occ.price_cad != null;
  return {
    title: occ.title?.trim() || parent.title,
    duration_minutes: occ.duration_minutes ?? parent.duration_minutes,
    location: occ.location?.trim() || parent.location,
    lat: occ.location?.trim() ? (occ.lat ?? null) : parent.lat,
    lng: occ.location?.trim() ? (occ.lng ?? null) : parent.lng,
    price_cad: hasPriceOverride ? occ.price_cad : parent.price_cad,
    sale_price_cad: hasPriceOverride ? (occ.sale_price_cad ?? null) : parent.sale_price_cad,
    sale_starts_on: hasPriceOverride ? null : parent.sale_starts_on,
    sale_ends_on: hasPriceOverride ? null : parent.sale_ends_on,
  };
}

export function eventFieldsForOccurrenceStart<
  T extends {
    title?: string | null;
    duration_minutes?: number | null;
    location?: string | null;
    lat?: number | null;
    lng?: number | null;
    price_cad?: number | null;
    sale_price_cad?: number | null;
    sale_starts_on?: string | null;
    sale_ends_on?: string | null;
    workshop_series?: string | null;
    series_occurrences?: unknown;
  },
>(parent: T, startTime?: string | null) {
  const series = parseSeriesOccurrences(parent);
  if (series.length === 0) return resolveOccurrenceListingFields(parent, null);
  const idx = findOccurrenceIndexByStart(series, startTime ?? undefined);
  return resolveOccurrenceListingFields(parent, idx >= 0 ? series[idx] : null);
}

export function isMultiWeekEvent(row: EventSeriesFields): boolean {
  return row.workshop_series === 'multi_week' && parseSeriesOccurrences(row).length > 0;
}

const MATCH_START_MS = 5 * 60 * 1000;

export function findOccurrenceIndexByStart(series: SeriesOccurrence[], candidate: string | undefined): number {
  if (series.length === 0) return -1;
  if (!candidate?.trim()) return 0;
  const t = new Date(candidate).getTime();
  if (Number.isNaN(t)) return -1;
  let best = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < series.length; i++) {
    const dt = new Date(series[i].start).getTime();
    if (Number.isNaN(dt)) continue;
    const d = Math.abs(dt - t);
    if (d < bestDelta) {
      bestDelta = d;
      best = i;
    }
  }
  if (bestDelta <= MATCH_START_MS) return best;
  return -1;
}
