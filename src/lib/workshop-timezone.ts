import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'

/** Canonical timezone for workshop schedules (Toronto observes EST/EDT). */
export const WORKSHOP_TIMEZONE = 'America/Toronto'

const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/**
 * Parse partner `datetime-local` or naive datetime strings as America/Toronto wall time.
 * Returns a UTC instant suitable for TIMESTAMPTZ storage.
 *
 * Without this, Vercel (UTC) treats `2026-05-30T17:40` as 17:40 UTC → displays as 1:40 PM in Toronto.
 */
export function parseWorkshopDateTimeInput(s: string): Date | null {
  const trimmed = s.trim()
  if (!trimmed) return null

  const local = DATETIME_LOCAL_RE.exec(trimmed)
  if (local) {
    const [, y, mo, d, h, mi, sec = '00'] = local
    const tzDate = new TZDate(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(sec),
      WORKSHOP_TIMEZONE
    )
    return new Date(tzDate.getTime())
  }

  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Format a stored instant for HTML `datetime-local` in America/Toronto. */
export function formatWorkshopDateTimeLocalValue(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ''
  const tzDate = new TZDate(d.getTime(), WORKSHOP_TIMEZONE)
  return format(tzDate, "yyyy-MM-dd'T'HH:mm")
}

/** Email/UI display — always America/Toronto (EST/EDT). */
export function formatWorkshopDateTimeForDisplay(date: Date): string {
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: WORKSHOP_TIMEZONE,
    timeZoneName: 'short',
  })
}

/** Shorter label for vendor notifications. */
export function formatWorkshopDateTimeShort(date: Date): string {
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: WORKSHOP_TIMEZONE,
    timeZoneName: 'short',
  })
}
