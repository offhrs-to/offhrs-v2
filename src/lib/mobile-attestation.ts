import type { NextRequest } from 'next/server'

type AttestationResult =
  | { ok: true; skipped: boolean }
  | { ok: false; status: number; error: string }

const VERIFY_TIMEOUT_MS = 5000

function isEnforced(): boolean {
  return process.env.ENFORCE_MOBILE_ATTESTATION === '1'
}

/**
 * Optional server-side attestation gate.
 * When ENFORCE_MOBILE_ATTESTATION=1, sensitive endpoints require a token and
 * verification service URL:
 * - PLAY_INTEGRITY_VERIFY_URL for android
 * - APP_ATTEST_VERIFY_URL for ios
 */
export async function requireMobileAttestation(
  request: NextRequest,
  route: string
): Promise<AttestationResult> {
  if (!isEnforced()) return { ok: true, skipped: true }

  const platform = (request.headers.get('x-offhrs-platform') || '').toLowerCase()
  const token = request.headers.get('x-offhrs-attestation-token')
  if (!token) {
    return { ok: false, status: 401, error: 'Missing attestation token' }
  }
  if (platform !== 'android' && platform !== 'ios') {
    return { ok: false, status: 400, error: 'Missing or invalid platform header' }
  }

  const verifyUrl =
    platform === 'android'
      ? process.env.PLAY_INTEGRITY_VERIFY_URL
      : process.env.APP_ATTEST_VERIFY_URL
  if (!verifyUrl) {
    return { ok: false, status: 503, error: 'Attestation verifier unavailable' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)
  try {
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MOBILE_ATTESTATION_SHARED_SECRET || ''}`,
      },
      body: JSON.stringify({
        token,
        platform,
        route,
      }),
      signal: controller.signal,
    })
    if (!response.ok) {
      return { ok: false, status: 401, error: 'Attestation check failed' }
    }
    return { ok: true, skipped: false }
  } catch {
    return { ok: false, status: 503, error: 'Attestation check unavailable' }
  } finally {
    clearTimeout(timeout)
  }
}

