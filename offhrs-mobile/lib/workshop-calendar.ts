import type { WorkshopEventRow } from '@/lib/workshops-events-query';
import { workshopEventTorontoYmd } from '@/lib/workshop-event-sort';

/** YYYY-MM-DD in America/Toronto for "today". */
export function getTorontoYmd(d = new Date()): string {
  return d.toLocaleDateString('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export type DateStripItem = { ymd: string; label: string; isToday: boolean };

// `toLocaleDateString(...)` builds a fresh `Intl.DateTimeFormat` internally on every call, and
// that construction (not the formatting itself) is the expensive part on Android/Hermes.
// Reusing one formatter per shape across all 90 days below cuts ~180 formatter constructions
// down to 2, which is what actually made this loop noticeably slow on Android's first render.
const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const shortLabelFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Toronto',
  weekday: 'short',
  day: 'numeric',
});

/** Rolling window of calendar days for date strip (labels use America/Toronto). */
export function buildDateStrip(dayCount: number): DateStripItem[] {
  const todayYmd = ymdFormatter.format(new Date());
  const out: DateStripItem[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + i);
    const ymd = ymdFormatter.format(d);
    const short = shortLabelFormatter.format(d);
    const isToday = ymd === todayYmd;
    const label = i === 0 && isToday ? `Today · ${short}` : short;
    out.push({ ymd, label, isToday });
  }
  return out;
}

/** Event appears on a given calendar day (Toronto date string). */
export function eventMatchesCalendarDay(e: WorkshopEventRow, ymd: string): boolean {
  if (e.recurrence === 'daily' || e.recurrence === 'weekly') return true;
  const eventYmd = workshopEventTorontoYmd(e);
  return eventYmd !== '' && eventYmd === ymd;
}

