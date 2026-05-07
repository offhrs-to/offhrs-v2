/**
 * Minimal RFC 5545-compliant .ics file generator.
 * No external dependencies — keeps bundle size zero.
 */

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function icsText(s: string): string {
  // Fold long lines at 75 chars and escape special chars
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export interface IcsEventParams {
  uid: string
  summary: string
  description?: string
  location?: string
  url?: string
  dtstart: Date
  dtend: Date
  organizer?: { name: string; email: string }
  method?: 'REQUEST' | 'CANCEL'
}

export function generateIcs(params: IcsEventParams): string {
  const {
    uid,
    summary,
    description,
    location,
    url,
    dtstart,
    dtend,
    organizer,
    method = 'REQUEST',
  } = params

  const now = icsDate(new Date())
  const start = icsDate(dtstart)
  const end = icsDate(dtend)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//offhrs//offhrs Booking//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsText(summary)}`,
  ]

  if (description) lines.push(`DESCRIPTION:${icsText(description)}`)
  if (location) lines.push(`LOCATION:${icsText(location)}`)
  if (url) lines.push(`URL:${url}`)
  if (organizer) {
    lines.push(`ORGANIZER;CN=${icsText(organizer.name)}:mailto:${organizer.email}`)
  }
  if (method === 'CANCEL') {
    lines.push('STATUS:CANCELLED')
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')

  // Fold lines longer than 75 octets (RFC 5545 §3.1)
  return lines
    .flatMap((line) => {
      if (line.length <= 75) return [line]
      const chunks: string[] = []
      let i = 0
      while (i < line.length) {
        chunks.push((i === 0 ? '' : ' ') + line.slice(i, i + (i === 0 ? 75 : 74)))
        i += i === 0 ? 75 : 74
      }
      return chunks
    })
    .join('\r\n')
}
