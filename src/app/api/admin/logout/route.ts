import { getAdminCookieName, verifyAdmin } from '@/app/api/admin/login/route'
import { logSecurityEvent } from '@/lib/security-monitor'
import { getRateLimitKey } from '@/lib/rate-limit'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/admin/logout
 * Clears the admin session cookie so the user must log in again.
 * Verifies the caller has (or had) a valid session first, purely for audit
 * logging — clearing an already-invalid cookie is harmless either way.
 */
export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    logSecurityEvent('info', {
      type: 'admin_logout_without_session',
      route: '/api/admin/logout',
      ipKey: getRateLimitKey(request),
    })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(getAdminCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return res
}

