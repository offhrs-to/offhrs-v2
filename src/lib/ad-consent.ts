/** localStorage key for Meta advertising / pixel consent on the marketing site. */
export const AD_CONSENT_STORAGE_KEY = 'offhrs_ad_consent'

export type AdConsentValue = 'accepted' | 'declined'

export const META_PIXEL_ID = '1674304227024425'

export function readAdConsent(): AdConsentValue | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(AD_CONSENT_STORAGE_KEY)
    if (v === 'accepted' || v === 'declined') return v
  } catch {
    /* private mode / blocked storage */
  }
  return null
}

export function writeAdConsent(value: AdConsentValue): void {
  try {
    window.localStorage.setItem(AD_CONSENT_STORAGE_KEY, value)
  } catch {
    /* ignore */
  }
}
