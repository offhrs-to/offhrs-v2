/**
 * Cloudflare Turnstile server-side verification.
 *
 * If TURNSTILE_SECRET_KEY is not configured (e.g. local dev before the
 * Cloudflare site is set up), verification is skipped and treated as passing —
 * this mirrors the client widget, which also doesn't render without a site key,
 * so existing signup flows keep working until the keys are provisioned.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export type TurnstileVerifyResult = { ok: true } | { ok: false; reason: string }

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null
): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return { ok: true }

  if (!token) return { ok: false, reason: 'missing-token' }

  try {
    const body = new URLSearchParams({ secret, response: token })
    if (remoteIp) body.set('remoteip', remoteIp)

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    if (data.success) return { ok: true }
    return { ok: false, reason: data['error-codes']?.join(',') ?? 'verification-failed' }
  } catch (err) {
    console.error('Turnstile verification request failed:', err)
    return { ok: false, reason: 'verification-request-failed' }
  }
}
