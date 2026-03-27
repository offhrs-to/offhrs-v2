/**
 * Canadian postal code: one letter, digit, letter, digit, letter, digit (FSA + LDU).
 * User may enter with or without a space between the 3rd and 4th character.
 */
const CA_POSTAL_BODY =
  /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/i;

/**
 * Returns normalized "A1A 1A1" or null if invalid.
 */
export function parseCanadianPostalCode(input: string): string | null {
  const compact = input.replace(/[\s-]/g, '').toUpperCase();
  if (compact.length !== 6) return null;
  if (!CA_POSTAL_BODY.test(compact)) return null;
  return `${compact.slice(0, 3)} ${compact.slice(3)}`;
}

export function isValidCanadianPostalInput(input: string): boolean {
  return parseCanadianPostalCode(input) != null;
}
