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

export function verifyAdminCookie(cookieHeader: string | null): boolean {
  if (!getSecret()) return false
  if (!cookieHeader) return false
  const pairs = cookieHeader.split(';').map((s) => s.trim())
  let value: string | null = null
  for (const p of pairs) {
    if (p.startsWith(ADMIN_COOKIE + '=')) {
      value = p.slice(ADMIN_COOKIE.length + 1).trim()
      break
    }
  }
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

export function verifyAdminBasicAuth(authHeader: string | null): boolean {
  if (!authHeader || !authHeader.startsWith('Basic ')) return false
  const adminUser = process.env.ADMIN_USER || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return false
  try {
    const base64 = authHeader.slice(6).trim()
    const decoded = Buffer.from(base64, 'base64').toString('utf8')
    const colon = decoded.indexOf(':')
    if (colon <= 0) return false
    const username = decoded.slice(0, colon)
    const password = decoded.slice(colon + 1)
    const expectedUser = Buffer.from(adminUser, 'utf8')
    const expectedPass = Buffer.from(adminPassword, 'utf8')
    const givenUser = Buffer.from(username, 'utf8')
    const givenPass = Buffer.from(password, 'utf8')
    return (
      expectedUser.length === givenUser.length &&
      expectedPass.length === givenPass.length &&
      timingSafeEqual(expectedUser, givenUser) &&
      timingSafeEqual(expectedPass, givenPass)
    )
  } catch {
    return false
  }
}

export function verifyAdmin(request: NextRequest): boolean {
  return (
    verifyAdminCookie(request.headers.get('cookie')) ||
    verifyAdminBasicAuth(request.headers.get('authorization'))
  )
}
