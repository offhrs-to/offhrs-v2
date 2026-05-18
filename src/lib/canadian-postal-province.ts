/** Map Canadian postal code FSA first letter → province/territory code (approximate). */
const FSA_LETTER_TO_PROVINCE: Record<string, string> = {
  A: 'NL',
  B: 'NS',
  C: 'PE',
  E: 'NB',
  G: 'QC',
  H: 'QC',
  J: 'QC',
  K: 'ON',
  L: 'ON',
  M: 'ON',
  N: 'ON',
  P: 'ON',
  R: 'MB',
  S: 'SK',
  T: 'AB',
  V: 'BC',
  X: 'NT',
  Y: 'YT',
}

/** Normalize to "A1A 1A1" or null. */
export function normalizeCanadianPostalCode(input: string): string | null {
  const compact = input.replace(/[\s-]/g, '').toUpperCase()
  if (compact.length !== 6) return null
  if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact)) return null
  return `${compact.slice(0, 3)} ${compact.slice(3)}`
}

/** Infer CA province/territory code from postal code (e.g. M5C 0B6 → ON). */
export function provinceFromCanadianPostalCode(postalCode: string): string | null {
  const norm = normalizeCanadianPostalCode(postalCode)
  if (!norm) return null
  const letter = norm.charAt(0)
  return FSA_LETTER_TO_PROVINCE[letter] ?? null
}

export type CustomerTaxAddress = {
  country: 'CA'
  postal_code: string
  state: string
  city?: string
  line1?: string
}

/** Build Stripe Tax `customer_details.address` from postal (and optional overrides). */
export function customerTaxAddressFromPostal(
  postalCode: string,
  overrides?: Partial<{ state: string; city: string; line1: string }>
): CustomerTaxAddress | null {
  const postal_code = normalizeCanadianPostalCode(postalCode)
  if (!postal_code) return null
  const state = overrides?.state?.trim().toUpperCase() || provinceFromCanadianPostalCode(postal_code)
  if (!state) return null
  return {
    country: 'CA',
    postal_code,
    state,
    ...(overrides?.city ? { city: overrides.city.trim() } : {}),
    ...(overrides?.line1 ? { line1: overrides.line1.trim() } : {}),
  }
}
