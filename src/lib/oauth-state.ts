import { createHmac, timingSafeEqual } from 'crypto'

function secret(): string {
  const s = process.env.OAUTH_STATE_SECRET ?? process.env.CRON_SECRET ?? process.env.TOKEN_ENCRYPTION_KEY
  if (!s) throw new Error('Set OAUTH_STATE_SECRET (or CRON_SECRET) for calendar OAuth state signing')
  return s
}

export type CalendarOAuthProvider = 'google' | 'microsoft'

export interface OAuthStatePayload {
  vendorId: string
  provider: CalendarOAuthProvider
  exp: number
}

/** Compact signed state for OAuth `state` param (HMAC-SHA256). */
export function signOAuthState(payload: OAuthStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const dot = state.lastIndexOf('.')
  if (dot <= 0) return null
  const body = state.slice(0, dot)
  const sig = state.slice(dot + 1)
  const expected = createHmac('sha256', secret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthStatePayload
    if (!payload.vendorId || !payload.provider || typeof payload.exp !== 'number') return null
    if (Date.now() > payload.exp) return null
    if (payload.provider !== 'google' && payload.provider !== 'microsoft') return null
    return payload
  } catch {
    return null
  }
}
