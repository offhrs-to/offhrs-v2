/**
 * Format a street address with an optional unit/suite for display.
 * Geocode and Places should always use the street address alone (no unit).
 *
 * Example: Unit 17 - 88 Queen Street East, Toronto, ON M5C 0B6
 */
export function formatVenueAddress(
  address: string | null | undefined,
  unit?: string | null
): string {
  const street = (address ?? '').trim()
  const u = (unit ?? '').trim()
  if (!street) return u ? `Unit ${u}` : ''
  if (!u) return street
  return `Unit ${u} - ${street}`
}

/** Normalize free-text unit input (strips a leading "Unit" / "#" if the partner typed it). */
export function normalizeLocationUnit(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null
  const stripped = trimmed.replace(/^(unit|suite|apt\.?|apartment|#)\s*/i, '').trim()
  return stripped || null
}
