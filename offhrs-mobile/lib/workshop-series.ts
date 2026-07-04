/** Keep in sync with src/lib/workshop-series.ts (consumer-facing subset). */

export type SeriesOccurrence = {
  start: string;
  max_attendees: number;
  available_slots: number;
  registration_closed?: boolean;
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
      out.push({
        start,
        max_attendees: max,
        available_slots: avail,
        ...(registration_closed ? { registration_closed: true } : {}),
      });
    }
  }
  out.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return out;
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
