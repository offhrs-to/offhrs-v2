import { supabase } from '@/lib/supabase';
import { CONSUMER_BOOKING_STATUS_OR, isEventVisibleToConsumers } from '@/lib/consumer-event-visibility';
import { WORKSHOP_EVENTS_FETCH_BATCH, WORKSHOP_MAX_UPCOMING_FETCH } from '@/constants/workshops-list';

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
  external_link: string;
  lat: number | null;
  lng: number | null;
  vendor_id: string | null;
  /** When set, workshop is bookable in-app via Stripe (SaaS). */
  vendor_profile_id: string | null;
  recurrence: string | null;
  category: string | null;
  description: string | null;
  booking_status: string | null;
  available_slots: number | null;
};

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
  external_link: string | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
  vendor_id: string | null;
  vendor_profile_id: string | null;
  recurrence: string | null;
  description: string | null;
  booking_status: string | null;
  available_slots: number | null;
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
    external_link: row.external_link ?? '',
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    vendor_id: row.vendor_id ?? null,
    vendor_profile_id: row.vendor_profile_id ?? null,
    recurrence: row.recurrence ?? null,
    category: row.category ?? null,
    description: row.description ?? null,
    booking_status: row.booking_status ?? null,
    available_slots: row.available_slots ?? null,
  };
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
  'id, title, date, location, image_url, price, price_cad, external_link, category, lat, lng, vendor_id, vendor_profile_id, recurrence, description, booking_status, available_slots';

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
    const orParts = escapedWords.flatMap((w) => [`title.ilike.%${w}%`, `category.ilike.%${w}%`]);
    if (searchVendorIds.length > 0) orParts.push(`vendor_id.in.(${searchVendorIds.join(',')})`);
    searchOrClause = orParts.length > 0 ? orParts.join(',') : 'id.eq.-1';
  }

  const makeOrderedQuery = () => {
    let q = supabase.from('events').select(WORKSHOP_EVENT_LIST_SELECT);
    q = q.or(`recurrence.eq.daily,recurrence.eq.weekly,date.is.null,date.gte.${nowIso}`);
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
    .filter((e) => isEventVisibleToConsumers(e));

  const filteredByDate = list.filter((e) => {
    if (!e.date_iso) return !dateRangeStart && !dateRangeEnd;
    const eventDate = e.date_iso.slice(0, 10);
    if (dateRangeStart && eventDate < dateRangeStart) return false;
    if (dateRangeEnd && eventDate > dateRangeEnd) return false;
    return true;
  });

  const sorted = filteredByDate.sort((a, b) => {
    const aTime = a.date_iso ? new Date(a.date_iso).getTime() : Infinity;
    const bTime = b.date_iso ? new Date(b.date_iso).getTime() : Infinity;
    return aTime - bTime;
  });

  if (searchRawWords.length > 0 || searchVendorIds.length > 0) {
    return sorted.filter((e) => {
      if (searchVendorIds.length > 0 && e.vendor_id && searchVendorIds.includes(e.vendor_id)) return true;
      if (searchRawWords.length === 0) return true;
      return searchRawWords.every(
        (w) =>
          (e.title && e.title.toLowerCase().includes(w.toLowerCase())) ||
          (e.category && e.category.toLowerCase().includes(w.toLowerCase()))
      );
    });
  }

  return sorted;
}
