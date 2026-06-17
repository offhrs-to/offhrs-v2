/** Normalize a Canadian GST/HST registration number for storage (e.g. 123456789RT0001). */
export function normalizeGstHstRegistrationNumber(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

/** CRA GST/HST account format: 9-digit BN + RT + 4-digit reference (usually 0001). */
export function isValidGstHstRegistrationNumber(raw: string): boolean {
  const n = normalizeGstHstRegistrationNumber(raw)
  return /^\d{9}RT\d{4}$/.test(n)
}

export function formatGstHstRegistrationNumberForDisplay(stored: string | null | undefined): string {
  if (!stored?.trim()) return ''
  const n = normalizeGstHstRegistrationNumber(stored)
  const m = n.match(/^(\d{9})(RT)(\d{4})$/)
  if (!m) return stored.trim()
  return `${m[1]} ${m[2]} ${m[3]}`
}

export type VendorGstHstFields = {
  gst_hst_registered?: boolean | null
  gst_hst_registration_number?: string | null
}

export function vendorCollectsWorkshopGstHst(vendor: VendorGstHstFields): boolean {
  return vendor.gst_hst_registered === true
}

export function validateVendorGstHstAttestation(
  registered: boolean,
  registrationNumber: string | null | undefined
): { ok: true; registrationNumber: string | null } | { ok: false; error: string } {
  if (!registered) {
    return { ok: true, registrationNumber: null }
  }
  const trimmed = registrationNumber?.trim() ?? ''
  if (!trimmed) {
    return { ok: false, error: 'Enter your CRA GST/HST registration number.' }
  }
  if (!isValidGstHstRegistrationNumber(trimmed)) {
    return {
      ok: false,
      error: 'Use your full GST/HST number (e.g. 123456789 RT 0001).',
    }
  }
  return { ok: true, registrationNumber: normalizeGstHstRegistrationNumber(trimmed) }
}
