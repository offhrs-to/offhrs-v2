import type { WorkshopEventRow } from '@/lib/workshops-events-query';

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

/** Rolling window of calendar days for date strip (labels use America/Toronto). */
export function buildDateStrip(dayCount: number): DateStripItem[] {
  const todayYmd = getTorontoYmd(new Date());
  const out: DateStripItem[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + i);
    const ymd = d.toLocaleDateString('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const short = d.toLocaleDateString('en-US', {
      timeZone: 'America/Toronto',
      weekday: 'short',
      day: 'numeric',
    });
    const label = i === 0 && ymd === todayYmd ? `Today · ${short}` : short;
    out.push({ ymd, label, isToday: ymd === todayYmd });
  }
  return out;
}

/** Event appears on a given calendar day (Toronto date string). */
export function eventMatchesCalendarDay(e: WorkshopEventRow, ymd: string): boolean {
  if (e.recurrence === 'daily' || e.recurrence === 'weekly') return true;
  if (!e.date_iso) return false;
  const eventYmd = e.date_iso.slice(0, 10);
  return eventYmd === ymd;
}
