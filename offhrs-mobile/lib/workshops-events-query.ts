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

function formatDateToronto(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Toronto',
    });
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
};

export const WORKSHOP_EVENT_LIST_SELECT =
  'id, title, date, location, image_url, price, price_cad, sale_price_cad, sale_starts_on, sale_ends_on, external_link, category, lat, lng, vendor_id, vendor_profile_id, organizer, recurrence, description, workshop_experience, workshop_experience_hidden, workshop_materials_takeaway, workshop_materials_takeaway_hidden, workshop_skill_level, workshop_skill_level_hidden, booking_status, registration_closed, available_slots, duration_minutes, workshop_series, series_occurrences, partner_series_meta, max_attendees';

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
 */
export async function fetchWorkshopEvents(
  options: FetchWorkshopEventsOptions
): Promise<WorkshopEventRow[]> {
  const { searchTerm, categories, dateRangeStart, dateRangeEnd, limit = WORKSHOP_MAX_UPCOMING_FETCH } =
    options;
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

  const makeOrderedQuery = () => {
    let q = supabase.from('events').select(WORKSHOP_EVENT_LIST_SELECT);
    q = q.or(WORKSHOP_EVENTS_UPCOMING_OR(nowIso));
    q = q.or(CONSUMER_BOOKING_STATUS_OR);
    if (searchOrClause) {
      q = q.or(searchOrClause);
    }
    if (categories.length > 0) {
      q = q.in('category', categories);
    }
    return q.order('date', { ascending: true });
  };

  const cap = Math.min(limit, 15000);
  const batch = WORKSHOP_EVENTS_FETCH_BATCH;
  const combined: WorkshopEventDbRow[] = [];

  for (let offset = 0; offset < cap; offset += batch) {
    const take = Math.min(batch, cap - offset);
    const { data, error } = await makeOrderedQuery().range(offset, offset + take - 1);
    if (error) throw error;
    if (!data?.length) break;
    combined.push(...data);
    if (data.length < take) break;
  }

  const list = combined
    .map(mapDbRowToWorkshopEvent)
    .filter((e) => isEventVisibleToConsumers(e))
    .filter((e) => eventMatchesDateRange(e, dateRangeStart, dateRangeEnd));

  const expanded = expandWorkshopEventsForConsumers(list).filter((e) =>
    occurrenceMatchesDateRange(e, dateRangeStart, dateRangeEnd)
  );

  const sorted = expanded.sort(compareWorkshopEventsByStart);

  let result = sorted;
  if (searchRawWords.length > 0 || searchVendorIds.length > 0) {
    result = sorted.filter((e) => {
      if (searchVendorIds.length > 0 && e.vendor_id && searchVendorIds.includes(e.vendor_id)) return true;
      if (searchRawWords.length === 0) return true;
      return searchRawWords.every(
        (w) =>
          (e.title && e.title.toLowerCase().includes(w.toLowerCase())) ||
          (e.category && e.category.toLowerCase().includes(w.toLowerCase())) ||
          (e.organizer && e.organizer.toLowerCase().includes(w.toLowerCase())) ||
          (e.vendor_name && e.vendor_name.toLowerCase().includes(w.toLowerCase()))
      );
    });
  }

  const named = await enrichWorkshopEventsWithVendorNames(result);
  return enrichWorkshopEventsWithMapCoordinates(named);
}

/**
 * Map / geo browse: upcoming visible events with coordinates inside a bbox around the user.
 * Avoids the date-ordered global fetch cap that can hide nearby workshops with later dates.
 */
export async function fetchWorkshopEventsNearAnchor(
  anchor: { lat: number; lng: number },
  options?: { radiusKm?: number; eventsCap?: number }
): Promise<WorkshopEventRow[]> {
  const radiusKm = options?.radiusKm ?? WORKSHOP_GEO_RADIUS_KM;
  const eventsCap = options?.eventsCap ?? WORKSHOP_GEO_EVENTS_CAP;
  const nowIso = new Date().toISOString();
  const box = bboxAround(anchor.lat, anchor.lng, radiusKm);

  const { data, error } = await supabase
    .from('events')
    .select(WORKSHOP_EVENT_LIST_SELECT)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .gte('lat', box.minLat)
    .lte('lat', box.maxLat)
    .gte('lng', box.minLng)
    .lte('lng', box.maxLng)
    .or(WORKSHOP_EVENTS_UPCOMING_OR(nowIso))
    .or(CONSUMER_BOOKING_STATUS_OR)
    .limit(eventsCap);

  if (error) {
    if (__DEV__) console.warn('fetchWorkshopEventsNearAnchor', error.message);
    throw error;
  }

  const list = ((data ?? []) as WorkshopEventDbRow[])
    .map(mapDbRowToWorkshopEvent)
    .filter((e) => isEventVisibleToConsumers(e))
    .filter((e) => {
      if (e.recurrence === 'daily' || e.recurrence === 'weekly') return true;
      if (e.workshop_series === 'multi_week') return true;
      if (!e.date_iso) return true;
      return e.date_iso >= nowIso;
    })
    .filter(
      (e) =>
        e.lat != null &&
        e.lng != null &&
        !Number.isNaN(Number(e.lat)) &&
        !Number.isNaN(Number(e.lng))
    );

  const withinRadius = list.filter((e) => {
    const km = haversineKm(anchor.lat, anchor.lng, Number(e.lat), Number(e.lng));
    return km <= radiusKm;
  });

  withinRadius.sort((a, b) => {
    const da = haversineKm(anchor.lat, anchor.lng, Number(a.lat), Number(a.lng));
    const db = haversineKm(anchor.lat, anchor.lng, Number(b.lat), Number(b.lng));
    return da - db;
  });

  const expanded = expandWorkshopEventsForConsumers(withinRadius);
  const named = await enrichWorkshopEventsWithVendorNames(expanded);
  return enrichWorkshopEventsWithMapCoordinates(named);
}
