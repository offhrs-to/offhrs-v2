import { supabase } from '@/lib/supabase';
import { CONSUMER_BOOKING_STATUS_OR, isEventVisibleToConsumers } from '@/lib/consumer-event-visibility';
import { bboxAround, haversineKm, WORKSHOP_GEO_EVENTS_CAP, WORKSHOP_GEO_RADIUS_KM } from '@/lib/distance';
import { enrichWorkshopEventsWithMapCoordinates } from '@/lib/workshop-map-coordinates';
import { enrichWorkshopEventsWithVendorNames } from '@/lib/workshop-vendor-display';
import { WORKSHOP_EVENTS_FETCH_BATCH, WORKSHOP_MAX_UPCOMING_FETCH } from '@/constants/workshops-list';
import {
  getSeriesMode,
  isMultiWeekEvent,
  parseSeriesOccurrences,
  type EventSeriesFields,
} from '@/lib/workshop-series';
import { compareWorkshopEventsByStart, workshopEventTorontoYmd } from '@/lib/workshop-event-sort';

export type WorkshopEventRow = {
  id: number;
  title: string;
  date: string;
  date_iso: string | null;
  location: string;
  image_url: string | null;
  price: number | string | null;
  /** SaaS price in CAD when `vendor_profile_id` is set. */
  price_cad: number | null;
  /** Optional sale price in CAD (strictly below `price_cad` when active). */
  sale_price_cad: number | null;
  /** Inclusive sale window (YYYY-MM-DD, America/Toronto). */
  sale_starts_on: string | null;
  sale_ends_on: string | null;
  external_link: string;
  lat: number | null;
  lng: number | null;
  vendor_id: string | null;
  /** Host name from `events.organizer` (partner business_name) or `vendors.name`. */
  vendor_name: string | null;
  /** Raw organizer column (partner business name). */
  organizer: string | null;
  /** When set, workshop is bookable in-app via Stripe (SaaS). */
  vendor_profile_id: string | null;
  recurrence: string | null;
  category: string | null;
  description: string | null;
  workshop_experience?: string | null;
  workshop_experience_hidden?: boolean | null;
  workshop_materials_takeaway?: string | null;
  workshop_materials_takeaway_hidden?: boolean | null;
  workshop_skill_level?: string | null;
  workshop_skill_level_hidden?: boolean | null;
  registration_closed?: boolean | null;
  booking_status: string | null;
  available_slots: number | null;
  duration_minutes: number | null;
  /** `multi_week` when this listing uses `series_occurrences` (repeating days, etc.). */
  workshop_series?: string | null;
  series_occurrences?: unknown;
  partner_series_meta?: unknown;
  max_attendees?: number | null;
};

/** Unique key per bookable session (same event id can have many occurrence rows). */
export function workshopSessionKey(e: {
  id: number;
  date_iso?: string | null;
  date?: string;
}): string {
  return `${e.id}\u0001${e.date_iso ?? e.date ?? ''}`;
}

// `toLocaleDateString(...)` builds a fresh `Intl.DateTimeFormat` internally on every call, and
// that construction (not the formatting itself) is the expensive part on Android/Hermes. This
// runs once per fetched row, so on a browse fetch of hundreds of events that construction cost
// was a meaningful chunk of "takes a while to load everything" on Android specifically — reusing
// one formatter across all rows avoids paying it repeatedly.
const dateTorontoFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Toronto',
});

function formatDateToronto(isoString: string): string {
  try {
    const d = new Date(isoString);
    return dateTorontoFormatter.format(d);
  } catch {
    return isoString;
  }
}

export type WorkshopEventDbRow = {
  id: number;
  title: string | null;
  date: string | null;
  location: string | null;
  image_url: string | null;
  price: number | string | null;
  price_cad: number | string | null;
  sale_price_cad?: number | string | null;
  sale_starts_on?: string | null;
  sale_ends_on?: string | null;
  external_link: string | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
  vendor_id: string | null;
  organizer: string | null;
  vendor_profile_id: string | null;
  recurrence: string | null;
  description: string | null;
  workshop_experience?: string | null;
  workshop_experience_hidden?: boolean | null;
  workshop_materials_takeaway?: string | null;
  workshop_materials_takeaway_hidden?: boolean | null;
  workshop_skill_level?: string | null;
  workshop_skill_level_hidden?: boolean | null;
  registration_closed?: boolean | null;
  booking_status: string | null;
  available_slots: number | null;
  duration_minutes: number | null;
  workshop_series?: string | null;
  series_occurrences?: unknown;
  partner_series_meta?: unknown;
  max_attendees?: number | null;
};

export function mapDbRowToWorkshopEvent(row: WorkshopEventDbRow): WorkshopEventRow {
  return {
    id: row.id,
    title: row.title ?? '',
    date: formatDateToronto(row.date ?? ''),
    date_iso: row.date ?? null,
    location: row.location ?? '',
    image_url: row.image_url ?? null,
    price: row.price ?? null,
    price_cad: row.price_cad != null ? Number(row.price_cad) : null,
    sale_price_cad: row.sale_price_cad != null ? Number(row.sale_price_cad) : null,
    sale_starts_on: row.sale_starts_on ? String(row.sale_starts_on).slice(0, 10) : null,
    sale_ends_on: row.sale_ends_on ? String(row.sale_ends_on).slice(0, 10) : null,
    external_link: row.external_link ?? '',
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    vendor_id: row.vendor_id ?? null,
    vendor_name: row.organizer?.trim() || null,
    organizer: row.organizer?.trim() || null,
    vendor_profile_id: row.vendor_profile_id ?? null,
    recurrence: row.recurrence ?? null,
    category: row.category ?? null,
    description: row.description ?? null,
    workshop_experience: row.workshop_experience ?? null,
    workshop_experience_hidden: row.workshop_experience_hidden ?? false,
    workshop_materials_takeaway: row.workshop_materials_takeaway ?? null,
    workshop_materials_takeaway_hidden: row.workshop_materials_takeaway_hidden ?? false,
    workshop_skill_level: row.workshop_skill_level ?? null,
    workshop_skill_level_hidden: row.workshop_skill_level_hidden ?? false,
    registration_closed: row.registration_closed ?? false,
    booking_status: row.booking_status ?? null,
    available_slots: row.available_slots ?? null,
    duration_minutes: row.duration_minutes != null ? Number(row.duration_minutes) : null,
    workshop_series: row.workshop_series ?? null,
    series_occurrences: row.series_occurrences,
    partner_series_meta: row.partner_series_meta,
    max_attendees: row.max_attendees != null ? Number(row.max_attendees) : null,
  };
}

const BOOKABLE_START_GRACE_MS = 60_000;

/**
 * Expand `multi_week` workshops for the consumer list.
 *
 * - per_occurrence (daily_weekdays): one row per upcoming, available session — each pill is independently bookable.
 * - cohort (weekly_same, weekly_custom): a single bookable unit (same participants attend every session); emit one
 *   row anchored at the first upcoming session so the card surfaces once with cohort-wide availability.
 */
export function expandWorkshopEventsForConsumers(rows: WorkshopEventRow[]): WorkshopEventRow[] {
  const nowMs = Date.now() - BOOKABLE_START_GRACE_MS;
  const out: WorkshopEventRow[] = [];

  for (const row of rows) {
    if (!isMultiWeekEvent(row as EventSeriesFields)) {
      out.push(row);
      continue;
    }

    const series = parseSeriesOccurrences(row as EventSeriesFields);
    const mode = getSeriesMode(row as EventSeriesFields);

    if (mode === 'cohort') {
      const cohortMax = row.max_attendees ?? series[0]?.max_attendees ?? 0;
      const cohortSlots = row.available_slots ?? series[0]?.available_slots ?? 0;
      const firstUpcoming = series.find((o) => {
        const startMs = new Date(o.start).getTime();
        return Number.isFinite(startMs) && startMs >= nowMs;
      });
      if (!firstUpcoming) continue;
      if (row.registration_closed) continue;
      if (cohortSlots <= 0) continue;
      out.push({
        ...row,
        date_iso: firstUpcoming.start,
        date: formatDateToronto(firstUpcoming.start),
        available_slots: cohortSlots,
        max_attendees: cohortMax,
        workshop_series: 'multi_week',
      });
      continue;
    }

    for (const o of series) {
      const startMs = new Date(o.start).getTime();
      if (!Number.isFinite(startMs) || startMs < nowMs) continue;
      if (row.registration_closed || o.registration_closed) continue;
      if (o.available_slots <= 0) continue;
      out.push({
        ...row,
        date_iso: o.start,
        date: formatDateToronto(o.start),
        available_slots: o.available_slots,
        registration_closed: false,
        workshop_series: 'multi_week',
      });
    }
  }

  return out;
}

function eventMatchesDateRange(
  e: WorkshopEventRow,
  dateRangeStart: string | null,
  dateRangeEnd: string | null
): boolean {
  if (!dateRangeStart && !dateRangeEnd) return true;

  const series = parseSeriesOccurrences(e as EventSeriesFields);
  if (series.length > 1) {
    const today = new Date().toISOString().slice(0, 10);
    const occs = series.filter((o) => o.start.slice(0, 10) >= today && o.available_slots > 0);
    if (occs.length === 0) return false;
    return occs.some((o) => {
      const eventDate = o.start.slice(0, 10);
      if (dateRangeStart && eventDate < dateRangeStart) return false;
      if (dateRangeEnd && eventDate > dateRangeEnd) return false;
      return true;
    });
  }

  if (!e.date_iso) return !dateRangeStart && !dateRangeEnd;
  const eventDate = workshopEventTorontoYmd(e);
  if (!eventDate) return false;
  if (dateRangeStart && eventDate < dateRangeStart) return false;
  if (dateRangeEnd && eventDate > dateRangeEnd) return false;
  return true;
}

function occurrenceMatchesDateRange(
  e: WorkshopEventRow,
  dateRangeStart: string | null,
  dateRangeEnd: string | null
): boolean {
  if (!dateRangeStart && !dateRangeEnd) return true;
  const eventDate = workshopEventTorontoYmd(e);
  if (!eventDate) return false;
  if (dateRangeStart && eventDate < dateRangeStart) return false;
  if (dateRangeEnd && eventDate > dateRangeEnd) return false;
  return true;
}

export type FetchWorkshopEventsOptions = {
  searchTerm: string;
  /** Empty = all categories */
  categories: string[];
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  limit?: number;
  /**
   * Omit long description fields (default true). Cards don't need them; quick view
   * hydrates via `fetchWorkshopEventForQuickView`.
   */
  light?: boolean;
  /**
   * Skip vendor lat/lng enrichment (default false). Browse distance filters need coords;
   * search/hub can skip when unused.
   */
  skipMapCoords?: boolean;
  /**
   * Progressive UI: called once after the first page is processed (fast path, no enrichment).
   * The returned promise still contains the fully enriched list.
   */
  onPartial?: (rows: WorkshopEventRow[]) => void;
};

export const WORKSHOP_EVENT_LIST_SELECT =
  'id, title, date, location, image_url, price, price_cad, sale_price_cad, sale_starts_on, sale_ends_on, external_link, category, lat, lng, vendor_id, vendor_profile_id, organizer, recurrence, description, workshop_experience, workshop_experience_hidden, workshop_materials_takeaway, workshop_materials_takeaway_hidden, workshop_skill_level, workshop_skill_level_hidden, booking_status, registration_closed, available_slots, duration_minutes, workshop_series, series_occurrences, partner_series_meta, max_attendees';

/**
 * List/browse select — omits long description blobs (hydrated when opening quick view).
 * Keeps `series_occurrences` so multi-week expand still works.
 */
export const WORKSHOP_EVENT_BROWSE_SELECT =
  'id, title, date, location, image_url, price, price_cad, sale_price_cad, sale_starts_on, sale_ends_on, external_link, category, lat, lng, vendor_id, vendor_profile_id, organizer, recurrence, booking_status, registration_closed, available_slots, duration_minutes, workshop_series, series_occurrences, max_attendees';

/** Same payload as list/quick-view so vendor-profile cards open with full details. */
export const VENDOR_PROFILE_EVENT_SELECT = WORKSHOP_EVENT_LIST_SELECT;

export const VENDOR_PROFILE_EVENTS_LIMIT = 80;

export const WORKSHOP_EVENTS_UPCOMING_OR = (nowIso: string) =>
  `recurrence.eq.daily,recurrence.eq.weekly,date.is.null,date.gte.${nowIso},workshop_series.eq.multi_week`;

/** Upcoming workshops for a vendor profile page (full quick-view payload, DB date filter, capped). */
export async function fetchVendorProfileEvents(vendorId: string): Promise<WorkshopEventRow[]> {
  return fetchVendorUpcomingEvents({ vendorId });
}

/** Upcoming workshops linked to a SaaS `vendor_profiles.id`. */
export async function fetchVendorProfileEventsByProfileId(
  vendorProfileId: string
): Promise<WorkshopEventRow[]> {
  return fetchVendorUpcomingEvents({ vendorProfileId });
}

async function fetchVendorUpcomingEvents(opts: {
  vendorId?: string;
  vendorProfileId?: string;
}): Promise<WorkshopEventRow[]> {
  const nowIso = new Date().toISOString();
  let q = supabase
    .from('events')
    .select(VENDOR_PROFILE_EVENT_SELECT)
    .or(CONSUMER_BOOKING_STATUS_OR)
    .or(WORKSHOP_EVENTS_UPCOMING_OR(nowIso))
    .order('date', { ascending: true, nullsFirst: false })
    .limit(VENDOR_PROFILE_EVENTS_LIMIT);

  if (opts.vendorProfileId) {
    q = q.eq('vendor_profile_id', opts.vendorProfileId);
  } else if (opts.vendorId) {
    q = q.eq('vendor_id', opts.vendorId);
  } else {
    return [];
  }

  const { data, error } = await q;

  if (error || !data?.length) {
    if (error && __DEV__) {
      console.warn('fetchVendorUpcomingEvents failed', error.message);
    }
    return [];
  }

  const eventList = data
    .filter((e) => isEventVisibleToConsumers(e as WorkshopEventDbRow))
    .filter((e) => {
      const row = e as WorkshopEventDbRow;
      const recurrence = row.recurrence;
      if (recurrence === 'daily' || recurrence === 'weekly') return true;
      if (isMultiWeekEvent(row)) return true;
      if (!row.date) return true;
      return row.date >= nowIso;
    })
    .map((e) => mapDbRowToWorkshopEvent(e as WorkshopEventDbRow));

  const expanded = expandWorkshopEventsForConsumers(eventList);
  const named = await enrichWorkshopEventsWithVendorNames(expanded);
  return enrichWorkshopEventsWithMapCoordinates(named);
}

/**
 * Full quick-view payload for a single event id (same columns + enrichments as browse).
 * Used when opening a workshop from vendor profile so details match list/map quick views.
 */
export async function fetchWorkshopEventForQuickView(
  eventId: number
): Promise<WorkshopEventRow | null> {
  if (!Number.isInteger(eventId) || eventId <= 0) return null;
  const { data, error } = await supabase
    .from('events')
    .select(WORKSHOP_EVENT_LIST_SELECT)
    .eq('id', eventId)
    .maybeSingle();
  if (error || !data) {
    if (error && __DEV__) {
      console.warn('fetchWorkshopEventForQuickView failed', error.message);
    }
    return null;
  }
  const mapped = mapDbRowToWorkshopEvent(data as WorkshopEventDbRow);
  const expanded = expandWorkshopEventsForConsumers([mapped]);
  // Prefer the occurrence matching this listing if expand produced several; else first.
  const pick =
    expanded.find((e) => e.id === eventId) ?? expanded[0] ?? mapped;
  const named = await enrichWorkshopEventsWithVendorNames([pick]);
  const withCoords = await enrichWorkshopEventsWithMapCoordinates(named);
  return withCoords[0] ?? null;
}

/**
 * Shared Supabase fetch for workshop list/map flows (matches workshops tab logic).
 * Uses a light column set + parallel pages after the first batch so browse isn't blocked
 * on thousands of full description payloads.
 */
export async function fetchWorkshopEvents(
  options: FetchWorkshopEventsOptions
): Promise<WorkshopEventRow[]> {
  const {
    searchTerm,
    categories,
    dateRangeStart,
    dateRangeEnd,
    limit = WORKSHOP_MAX_UPCOMING_FETCH,
    light = true,
    skipMapCoords = false,
    onPartial,
  } = options;
  let searchRawWords: string[] = [];
  let searchVendorIds: string[] = [];
  let searchOrClause: string | null = null;

  const nowIso = new Date().toISOString();
  const term = searchTerm.trim();
  if (term) {
    searchRawWords = term.split(/\s+/).filter(Boolean);
    const escapedWords = searchRawWords.map((w) => w.replace(/%/g, '\\%'));
    if (escapedWords.length > 0) {
      const idSets: Set<string>[] = [];
      for (const word of escapedWords) {
        const { data: rows } = await supabase.from('vendors').select('id').ilike('name', `%${word}%`);
        idSets.push(new Set((rows ?? []).map((v) => v.id).filter(Boolean)));
      }
      let intersect = new Set(idSets[0] ?? []);
      for (let i = 1; i < idSets.length; i++) {
        intersect = new Set([...intersect].filter((id) => idSets[i]!.has(id)));
      }
      searchVendorIds = [...intersect];
    }
    const orParts = escapedWords.flatMap((w) => [
      `title.ilike.%${w}%`,
      `category.ilike.%${w}%`,
      `organizer.ilike.%${w}%`,
    ]);
    if (searchVendorIds.length > 0) orParts.push(`vendor_id.in.(${searchVendorIds.join(',')})`);
    searchOrClause = orParts.length > 0 ? orParts.join(',') : 'id.eq.-1';
  }

  const select = light ? WORKSHOP_EVENT_BROWSE_SELECT : WORKSHOP_EVENT_LIST_SELECT;

  const makeOrderedQuery = () => {
    let q = supabase.from('events').select(select);
    q = q.or(WORKSHOP_EVENTS_UPCOMING_OR(nowIso));
    q = q.or(CONSUMER_BOOKING_STATUS_OR);
    if (searchOrClause) {
      q = q.or(searchOrClause);
    }
    if (categories.length > 0) {
      // Include retired label so filters work before/while DB migration runs.
      const categoryFilter = [
        ...new Set(
          categories.flatMap((c) =>
            c === 'Scent & Candle' ? ['Scent & Candle', 'Beauty & Fragrance'] : [c]
          )
        ),
      ];
      q = q.in('category', categoryFilter);
    }
    return q.order('date', { ascending: true }).order('id', { ascending: true });
  };

  const processRows = (combined: WorkshopEventDbRow[]): WorkshopEventRow[] => {
    const list = combined
      .map(mapDbRowToWorkshopEvent)
      .filter((e) => isEventVisibleToConsumers(e))
      .filter((e) => eventMatchesDateRange(e, dateRangeStart, dateRangeEnd));

    const expanded = expandWorkshopEventsForConsumers(list).filter((e) =>
      occurrenceMatchesDateRange(e, dateRangeStart, dateRangeEnd)
    );

    const sorted = expanded.sort(compareWorkshopEventsByStart);

    if (searchRawWords.length === 0 && searchVendorIds.length === 0) {
      return sorted;
    }

    return sorted.filter((e) => {
      if (searchVendorIds.length > 0 && e.vendor_id && searchVendorIds.includes(e.vendor_id))
        return true;
      if (searchRawWords.length === 0) return true;
      return searchRawWords.every(
        (w) =>
          (e.title && e.title.toLowerCase().includes(w.toLowerCase())) ||
          (e.category && e.category.toLowerCase().includes(w.toLowerCase())) ||
          (e.organizer && e.organizer.toLowerCase().includes(w.toLowerCase())) ||
          (e.vendor_name && e.vendor_name.toLowerCase().includes(w.toLowerCase()))
      );
    });
  };

  const enrichRows = async (rows: WorkshopEventRow[]): Promise<WorkshopEventRow[]> => {
    const named = await enrichWorkshopEventsWithVendorNames(rows);
    if (skipMapCoords) return named;
    return enrichWorkshopEventsWithMapCoordinates(named);
  };

  const cap = Math.min(limit, 15000);
  const batch = WORKSHOP_EVENTS_FETCH_BATCH;
  const combined: WorkshopEventDbRow[] = [];

  const firstTake = Math.min(batch, cap);
  const { data: firstData, error: firstError } = await makeOrderedQuery().range(0, firstTake - 1);
  if (firstError) throw firstError;
  if (firstData?.length) combined.push(...(firstData as WorkshopEventDbRow[]));

  if (onPartial && combined.length > 0) {
    // Fast first paint: skip network enrichments so taps stay responsive while pages load.
    onPartial(processRows(combined));
  }

  if (combined.length >= firstTake && cap > firstTake) {
    const remainingPages = [];
    for (let offset = firstTake; offset < cap; offset += batch) {
      const take = Math.min(batch, cap - offset);
      remainingPages.push(makeOrderedQuery().range(offset, offset + take - 1));
    }
    const pages = await Promise.all(remainingPages);
    for (const page of pages) {
      if (page.error) throw page.error;
      if (page.data?.length) combined.push(...(page.data as WorkshopEventDbRow[]));
    }
  }

  return enrichRows(processRows(combined));
}

/** Slim columns for map geo scans — hydrate full rows only for surviving pins. */
const WORKSHOP_MAP_GEO_SCAN_SELECT =
  'id, date, lat, lng, vendor_id, vendor_profile_id, booking_status, registration_closed, recurrence, workshop_series, available_slots';

type WorkshopMapGeoScanRow = {
  id: number;
  date: string | null;
  lat: number | null;
  lng: number | null;
  vendor_id: string | null;
  vendor_profile_id: string | null;
  booking_status: string | null;
  registration_closed?: boolean | null;
  recurrence: string | null;
  workshop_series?: string | null;
  available_slots?: number | null;
};

function mapPinKey(lat: number, lng: number): string {
  return `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
}

function mapStudioKey(row: Pick<WorkshopMapGeoScanRow, 'vendor_profile_id' | 'vendor_id' | 'id' | 'lat' | 'lng'>): string {
  const profile = row.vendor_profile_id?.trim();
  if (profile) return `p:${profile}`;
  const vendor = row.vendor_id?.trim();
  if (vendor) return `v:${vendor}`;
  const lat = row.lat != null ? Number(row.lat) : null;
  const lng = row.lng != null ? Number(row.lng) : null;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `pin:${mapPinKey(lat, lng)}`;
  }
  return `id:${row.id}`;
}

function isUpcomingScanRow(row: WorkshopMapGeoScanRow, nowIso: string): boolean {
  if (row.recurrence === 'daily' || row.recurrence === 'weekly') return true;
  if (row.workshop_series === 'multi_week') return true;
  if (!row.date) return true;
  return row.date >= nowIso;
}

function scoreMapScanRow(row: WorkshopMapGeoScanRow): number {
  let score = 0;
  if (row.registration_closed) score -= 100;
  if (row.available_slots != null && Number(row.available_slots) <= 0) score -= 50;
  if (row.workshop_series === 'multi_week') score -= 10;
  return score;
}

function preferMapScanRow(a: WorkshopMapGeoScanRow, b: WorkshopMapGeoScanRow): WorkshopMapGeoScanRow {
  const sa = scoreMapScanRow(a);
  const sb = scoreMapScanRow(b);
  if (sa !== sb) return sa > sb ? a : b;
  if (!a.date) return b;
  if (!b.date) return a;
  return a.date <= b.date ? a : b;
}

/**
 * One representative upcoming session per studio/vendor.
 * Prefer bookable one-day sessions so multi-week expand cannot erase the pin later.
 * (Lat/lng-only keys would collapse distinct vendors that share a building.)
 */
function dedupeMapGeoScanRows(rows: WorkshopMapGeoScanRow[]): WorkshopMapGeoScanRow[] {
  const byStudio = new Map<string, WorkshopMapGeoScanRow>();

  for (const row of rows) {
    const key = mapStudioKey(row);
    const prev = byStudio.get(key);
    byStudio.set(key, prev ? preferMapScanRow(prev, row) : row);
  }

  return [...byStudio.values()];
}

async function hydrateWorkshopEventsByIds(ids: number[]): Promise<WorkshopEventDbRow[]> {
  if (ids.length === 0) return [];
  const batch = WORKSHOP_EVENTS_FETCH_BATCH;
  const out: WorkshopEventDbRow[] = [];
  for (let i = 0; i < ids.length; i += batch) {
    const chunk = ids.slice(i, i + batch);
    const { data, error } = await supabase
      .from('events')
      .select(WORKSHOP_EVENT_LIST_SELECT)
      .in('id', chunk);
    if (error) {
      if (__DEV__) console.warn('hydrateWorkshopEventsByIds', error.message);
      throw error;
    }
    if (data?.length) out.push(...(data as WorkshopEventDbRow[]));
  }
  return out;
}

/**
 * Map / geo browse: upcoming visible events near the user.
 *
 * Performance: scans all in-bbox sessions with a slim select (paged in parallel so
 * PostgREST's ~1000-row cap cannot hide studios), keeps one row per vendor/studio, then
 * hydrates full payloads only for those studios. Full map coverage without loading
 * thousands of duplicate session rows into JS.
 */
export async function fetchWorkshopEventsNearAnchor(
  anchor: { lat: number; lng: number },
  options?: { radiusKm?: number; eventsCap?: number }
): Promise<WorkshopEventRow[]> {
  const radiusKm = options?.radiusKm ?? WORKSHOP_GEO_RADIUS_KM;
  const eventsCap = options?.eventsCap ?? WORKSHOP_GEO_EVENTS_CAP;
  const nowIso = new Date().toISOString();
  const box = bboxAround(anchor.lat, anchor.lng, radiusKm);
  const batch = WORKSHOP_EVENTS_FETCH_BATCH;

  const baseScan = () =>
    supabase
      .from('events')
      .select(WORKSHOP_MAP_GEO_SCAN_SELECT)
      .or(WORKSHOP_EVENTS_UPCOMING_OR(nowIso))
      .or(CONSUMER_BOOKING_STATUS_OR);

  const geoFilter = (q: ReturnType<typeof baseScan>) =>
    q
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .gte('lat', box.minLat)
      .lte('lat', box.maxLat)
      .gte('lng', box.minLng)
      .lte('lng', box.maxLng);

  const { count: geoCount, error: countError } = await geoFilter(
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .or(WORKSHOP_EVENTS_UPCOMING_OR(nowIso))
      .or(CONSUMER_BOOKING_STATUS_OR)
  );

  if (countError && __DEV__) {
    console.warn('fetchWorkshopEventsNearAnchor count', countError.message);
  }

  const totalGeo = Math.min(eventsCap, geoCount != null ? geoCount : eventsCap);
  const pageCount = Math.max(1, Math.ceil(Math.max(totalGeo, 1) / batch));

  const geoPages = await Promise.all(
    Array.from({ length: pageCount }, (_, page) => {
      const offset = page * batch;
      const take = Math.min(batch, eventsCap - offset);
      return geoFilter(baseScan())
        .order('date', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })
        .range(offset, offset + take - 1);
    })
  );

  const scanById = new Map<number, WorkshopMapGeoScanRow>();
  for (const res of geoPages) {
    if (res.error) {
      if (__DEV__) console.warn('fetchWorkshopEventsNearAnchor', res.error.message);
      throw res.error;
    }
    for (const row of (res.data ?? []) as WorkshopMapGeoScanRow[]) {
      scanById.set(row.id, row);
    }
  }

  // Partner workshops with null event coords: prefer studios whose profile pin is in-bbox.
  const { data: nearbyProfiles, error: profileErr } = await supabase
    .from('vendor_profiles')
    .select('id, location_lat, location_lng')
    .not('location_lat', 'is', null)
    .not('location_lng', 'is', null)
    .gte('location_lat', box.minLat)
    .lte('location_lat', box.maxLat)
    .gte('location_lng', box.minLng)
    .lte('location_lng', box.maxLng)
    .limit(500);

  if (profileErr && __DEV__) {
    console.warn('fetchWorkshopEventsNearAnchor profiles', profileErr.message);
  }

  const profileCoords = new Map<string, { lat: number; lng: number }>();
  for (const p of nearbyProfiles ?? []) {
    const lat = p.location_lat != null ? Number(p.location_lat) : null;
    const lng = p.location_lng != null ? Number(p.location_lng) : null;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (haversineKm(anchor.lat, anchor.lng, lat, lng) > radiusKm) continue;
    profileCoords.set(p.id, { lat, lng });
  }

  const profileIds = [...profileCoords.keys()];
  const PROFILE_IN_CHUNK = 100;
  if (profileIds.length > 0) {
    const profileChunks: string[][] = [];
    for (let i = 0; i < profileIds.length; i += PROFILE_IN_CHUNK) {
      profileChunks.push(profileIds.slice(i, i + PROFILE_IN_CHUNK));
    }
    const uncoordPages = await Promise.all(
      profileChunks.map((chunk) =>
        baseScan()
          .is('lat', null)
          .in('vendor_profile_id', chunk)
          .order('date', { ascending: true, nullsFirst: false })
          .order('id', { ascending: true })
          .limit(Math.min(batch, chunk.length * 4))
      )
    );
    for (const res of uncoordPages) {
      if (res.error) {
        if (__DEV__) console.warn('fetchWorkshopEventsNearAnchor uncoord', res.error.message);
        continue;
      }
      for (const row of (res.data ?? []) as WorkshopMapGeoScanRow[]) {
        if (scanById.has(row.id)) continue;
        const coords = row.vendor_profile_id
          ? profileCoords.get(row.vendor_profile_id)
          : undefined;
        scanById.set(row.id, coords ? { ...row, lat: coords.lat, lng: coords.lng } : row);
      }
    }
  }

  const visibleScan = [...scanById.values()].filter(
    (row) => isEventVisibleToConsumers(row) && isUpcomingScanRow(row, nowIso)
  );

  // Inherit coords from another scanned session for the same legacy vendor.
  const coordsByVendorId = new Map<string, { lat: number; lng: number }>();
  for (const row of visibleScan) {
    if (!row.vendor_id?.trim()) continue;
    const lat = row.lat != null ? Number(row.lat) : null;
    const lng = row.lng != null ? Number(row.lng) : null;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!coordsByVendorId.has(row.vendor_id.trim())) {
      coordsByVendorId.set(row.vendor_id.trim(), { lat, lng });
    }
  }
  const withCoordsScan = visibleScan.map((row) => {
    if (row.lat != null && row.lng != null) return row;
    const sibling = row.vendor_id?.trim()
      ? coordsByVendorId.get(row.vendor_id.trim())
      : undefined;
    return sibling ? { ...row, lat: sibling.lat, lng: sibling.lng } : row;
  });

  const withinRadius = withCoordsScan.filter((row) => {
    if (row.lat == null || row.lng == null) return false;
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    return haversineKm(anchor.lat, anchor.lng, lat, lng) <= radiusKm;
  });

  const pinRows = dedupeMapGeoScanRows(withinRadius);
  pinRows.sort((a, b) => {
    const da = haversineKm(anchor.lat, anchor.lng, Number(a.lat), Number(a.lng));
    const db = haversineKm(anchor.lat, anchor.lng, Number(b.lat), Number(b.lng));
    return da - db;
  });

  const hydrated = await hydrateWorkshopEventsByIds(pinRows.map((r) => r.id));
  const hydratedById = new Map(hydrated.map((r) => [r.id, r]));

  // Preserve pin-scan lat/lng when the hydrated row still lacks coords.
  const list = pinRows
    .map((scan) => {
      const full = hydratedById.get(scan.id);
      if (!full) return null;
      const mapped = mapDbRowToWorkshopEvent(full);
      if (
        (mapped.lat == null || mapped.lng == null) &&
        scan.lat != null &&
        scan.lng != null
      ) {
        return { ...mapped, lat: Number(scan.lat), lng: Number(scan.lng) };
      }
      return mapped;
    })
    .filter((e): e is WorkshopEventRow => e != null);

  const named = await enrichWorkshopEventsWithVendorNames(list);
  const withCoords = await enrichWorkshopEventsWithMapCoordinates(named);

  // Expand multi-week for nicer callout dates, but never drop a studio pin if expand
  // emits zero rows (sold-out cohort / no upcoming occurrence).
  const expanded = expandWorkshopEventsForConsumers(withCoords);
  const keptIds = new Set(expanded.map((e) => e.id));
  const rescued = withCoords.filter((e) => !keptIds.has(e.id));
  return [...expanded, ...rescued];
}
