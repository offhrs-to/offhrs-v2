/** Format street + optional unit for guest-facing display (unit is never used for geocoding).
 * Example: Unit 17 - 88 Queen Street East, Toronto, ON M5C 0B6
 */
export function formatVenueAddress(
  address: string | null | undefined,
  unit?: string | null
): string {
  const street = (address ?? '').trim();
  const u = (unit ?? '').trim();
  if (!street) return u ? `Unit ${u}` : '';
  if (!u) return street;
  return `Unit ${u} - ${street}`;
}
