/** Canadian weekday helpers for Marketplace ship-by SLA (no statutory holidays in v1). */

export function addCanadianBusinessDays(from: Date, days: number): Date {
  const d = new Date(from.getTime())
  let remaining = Math.max(0, days)
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    const weekday = d.getUTCDay()
    if (weekday !== 0 && weekday !== 6) remaining -= 1
  }
  return d
}

export function canadianBusinessDaysElapsed(from: Date, to: Date): number {
  let count = 0
  const cursor = new Date(from.getTime())
  cursor.setUTCHours(0, 0, 0, 0)
  const end = new Date(to.getTime())
  end.setUTCHours(0, 0, 0, 0)
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    const weekday = cursor.getUTCDay()
    if (weekday !== 0 && weekday !== 6) count += 1
  }
  return count
}
