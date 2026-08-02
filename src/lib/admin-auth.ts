import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

const ADMIN_COOKIE = 'admin_session'
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours

function getSecret(): string | null {
  return process.env.ADMIN_API_SECRET || null
}

export function signAdminSession(payload: string): string {
  const secret = getSecret()
  if (!secret) throw new Error('Admin API secret not configured')
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function getAdminCookieName(): string {
  return ADMIN_COOKIE
}

/** Cookie options for set/clear — secure whenever the request is HTTPS (incl. Vercel). */
export function adminSessionCookieOptions(request?: NextRequest): {
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: '/'
  maxAge: number
} {
  const proto =
    request?.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    request?.nextUrl.protocol.replace(':', '') ||
    ''
  const secure =
    proto === 'https' || process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_COOKIE_MAX_AGE,
  }
}

function readAdminCookieValue(cookieHeader: string): string | null {
  const pairs = cookieHeader.split(';').map((s) => s.trim())
  for (const p of pairs) {
    if (!p.startsWith(ADMIN_COOKIE + '=')) continue
    let value = p.slice(ADMIN_COOKIE.length + 1).trim()
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }
    try {
      value = decodeURIComponent(value)
    } catch {
      // keep raw
    }
    return value || null
  }
  return null
}

export function verifyAdminCookie(cookieHeader: string | null): boolean {
  if (!getSecret()) return false
  if (!cookieHeader) return false
  const value = readAdminCookieValue(cookieHeader)
  if (!value) return false
  const dot = value.indexOf('.')
  if (dot <= 0) return false
  const payload = value.slice(0, dot)
  const sig = value.slice(dot + 1)
  const expectedSig = signAdminSession(payload)
  try {
    if (sig.length !== expectedSig.length) return false
    if (!timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expectedSig, 'utf8'))) return false
    const parts = payload.split(':')
    if (parts[0] !== 'admin' || !parts[1]) return false
    const ts = Number(parts[1])
    if (Number.isNaN(ts) || Date.now() - ts > ADMIN_COOKIE_MAX_AGE * 1000) return false
    return true
  } catch {
    return false
  }
}

export function verifyAdmin(request: NextRequest): boolean {
  return verifyAdminCookie(request.headers.get('cookie'))
}
