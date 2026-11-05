import {
  normalizeCanadianPostalCode,
  provinceFromCanadianPostalCode,
} from '@/lib/canadian-postal-province'

/** Initial Artist Marketplace launch: ship / buy only within Ontario. */
export const MARKETPLACE_LAUNCH_PROVINCE = 'ON' as const

export const MARKETPLACE_ONTARIO_ONLY_MESSAGE =
  'Artist Marketplace currently ships and sells within Ontario only. Enter an Ontario address (postal codes starting with K, L, M, N, or P).'

export const MARKETPLACE_PICKUP_ONTARIO_ONLY_MESSAGE =
  'Pickup is only available for sellers with an Ontario pickup location during the initial Marketplace launch.'

const ON_FSA_LETTERS = new Set(['K', 'L', 'M', 'N', 'P'])

export function normalizeCaProvinceCode(input: string | null | undefined): string | null {
  const raw = String(input ?? '').trim().toUpperCase()
  if (!raw) return null
  if (raw === 'ONTARIO' || raw === 'ON.') return 'ON'
  if (/^[A-Z]{2}$/.test(raw)) return raw
  return null
}

/** True when postal FSA is Ontario (K/L/M/N/P). */
export function isOntarioPostalCode(postalCode: string | null | undefined): boolean {
  const norm = normalizeCanadianPostalCode(String(postalCode ?? ''))
  if (!norm) return false
  return ON_FSA_LETTERS.has(norm.charAt(0))
}

export function isOntarioProvinceCode(province: string | null | undefined): boolean {
  return normalizeCaProvinceCode(province) === MARKETPLACE_LAUNCH_PROVINCE
}

/**
 * Buyer ship-to must be Ontario by province code and postal FSA.
 * Rejects mismatched province/postal (e.g. province ON + BC postal).
 */
export function assertOntarioShipTo(params: {
  province: string
  postal_code: string
}): { ok: true } | { ok: false; error: string } {
  const province = normalizeCaProvinceCode(params.province)
  if (province !== MARKETPLACE_LAUNCH_PROVINCE) {
    return { ok: false, error: MARKETPLACE_ONTARIO_ONLY_MESSAGE }
  }
  if (!isOntarioPostalCode(params.postal_code)) {
    return { ok: false, error: MARKETPLACE_ONTARIO_ONLY_MESSAGE }
  }
  const fromPostal = provinceFromCanadianPostalCode(params.postal_code)
  if (fromPostal && fromPostal !== MARKETPLACE_LAUNCH_PROVINCE) {
    return { ok: false, error: MARKETPLACE_ONTARIO_ONLY_MESSAGE }
  }
  return { ok: true }
}

export function assertOntarioPickupLocation(params: {
  province: string | null | undefined
  postal_code?: string | null
}): { ok: true } | { ok: false; error: string } {
  if (!isOntarioProvinceCode(params.province)) {
    return { ok: false, error: MARKETPLACE_PICKUP_ONTARIO_ONLY_MESSAGE }
  }
  if (params.postal_code?.trim() && !isOntarioPostalCode(params.postal_code)) {
    return { ok: false, error: MARKETPLACE_PICKUP_ONTARIO_ONLY_MESSAGE }
  }
  return { ok: true }
}
