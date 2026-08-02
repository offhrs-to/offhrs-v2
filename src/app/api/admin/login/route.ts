import { adminLoginBodySchema } from '@/lib/api-validation'
import {
  adminSessionCookieOptions,
  getAdminCookieName,
  signAdminSession,
  verifyAdmin,
  verifyAdminCookie,
} from '@/lib/admin-auth'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { logSecurityEvent } from '@/lib/security-monitor'
import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const ADMIN_LOGIN_LIMIT = 8 // per minute per ip+username

export { getAdminCookieName, verifyAdmin, verifyAdminCookie }

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ADMIN_API_SECRET) {
      return NextResponse.json({ error: 'Admin API secret not configured' }, { status: 503 })
    }

    const raw = await request.json()
    if (typeof raw !== 'object' || raw === null) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }
    const parsed = adminLoginBodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }
    const { username, password } = parsed.data
    const rl = consumeRateLimit(
      `admin-login:${getRateLimitKey(request)}:${username.toLowerCase()}`,
      ADMIN_LOGIN_LIMIT
    )
    if (!rl.allowed) {
      logSecurityEvent('warn', {
        type: 'rate_limited',
        route: '/api/admin/login',
        ipKey: getRateLimitKey(request),
        details: { username: username.toLowerCase() },
      })
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again shortly.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rl.retryAfterSeconds),
          },
        }
      )
    }

    const adminUser = process.env.ADMIN_USER || 'admin'
    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword) {
      return NextResponse.json({ error: 'Admin not configured' }, { status: 503 })
    }

    const expectedUser = Buffer.from(adminUser, 'utf8')
    const expectedPass = Buffer.from(adminPassword, 'utf8')
    const givenUser = Buffer.from(username, 'utf8')
    const givenPass = Buffer.from(password, 'utf8')
    if (
      expectedUser.length !== givenUser.length ||
      expectedPass.length !== givenPass.length ||
      !timingSafeEqual(expectedUser, givenUser) ||
      !timingSafeEqual(expectedPass, givenPass)
    ) {
      logSecurityEvent('warn', {
        type: 'admin_login_failed',
        route: '/api/admin/login',
        ipKey: getRateLimitKey(request),
        details: { username: username.toLowerCase() },
      })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const payload = `admin:${Date.now()}`
    const value = `${payload}.${signAdminSession(payload)}`
    const res = NextResponse.json({ success: true })
    const opts = adminSessionCookieOptions(request)
    res.cookies.set(getAdminCookieName(), value, opts)
    return res
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}
