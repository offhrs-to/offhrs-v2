import type { WorkshopEventRow } from '@/lib/workshops-events-query';

const WORKSHOP_TIMEZONE = 'America/Toronto';

/** Parse a stored workshop instant (Postgres / ISO) to epoch ms. */
export function parseWorkshopInstantMs(iso: string | null | undefined): number {
  if (!iso?.trim()) return Number.NaN;
  let s = iso.trim();
  // Supabase/Postgres may return "YYYY-MM-DD HH:mm:ss+00" — Hermes needs a "T" separator.
  if (/^\d{4}-\d{2}-\d{2} /.test(s) && !s.includes('T')) {
    s = s.replace(' ', 'T');
  }
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? Number.NaN : t;
}

/** Sort key for a bookable session — earliest first; unknown dates sort last. */
export function workshopEventStartMs(e: Pick<WorkshopEventRow, 'date_iso' | 'date' | 'id'>): number {
  const fromIso = parseWorkshopInstantMs(e.date_iso);
  if (!Number.isNaN(fromIso)) return fromIso;
  if (e.date) {
    const fromDisplay = new Date(e.date).getTime();
    if (!Number.isNaN(fromDisplay)) return fromDisplay;
  }
  return Number.POSITIVE_INFINITY;
}

export function compareWorkshopEventsByStart(
  a: Pick<WorkshopEventRow, 'date_iso' | 'date' | 'id'>,
  b: Pick<WorkshopEventRow, 'date_iso' | 'date' | 'id'>
): number {
  const diff = workshopEventStartMs(a) - workshopEventStartMs(b);
  if (diff !== 0) return diff;
  return (a.id ?? 0) - (b.id ?? 0);
}

// `Intl`-backed timezone conversion (what `toLocaleDateString({ timeZone })` uses under the
// hood) is dramatically slower on Android/Hermes than on iOS for the same call — and this
// function is called for every event on every filter/sort/group pass, so on Android that cost
// compounds into the multi-second "clicking a filter is laggy" symptom that iOS didn't show.
// Cache by the raw `date_iso` string since a given event's timestamp never changes, so repeat
// calls across re-filters (the overwhelming majority) become a plain Map lookup instead of a
// fresh Intl computation.
const torontoYmdCache = new Map<string, string>();

/** Calendar day (YYYY-MM-DD) in America/Toronto for grouping / date strip. */
export function workshopEventTorontoYmd(e: Pick<WorkshopEventRow, 'date_iso'>): string {
  const key = e.date_iso ?? '';
  const cached = torontoYmdCache.get(key);
  if (cached !== undefined) return cached;

  const ms = parseWorkshopInstantMs(e.date_iso);
  const result = Number.isNaN(ms)
    ? ''
    : new Date(ms).toLocaleDateString('en-CA', {
        timeZone: WORKSHOP_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
  torontoYmdCache.set(key, result);
  return result;
}
