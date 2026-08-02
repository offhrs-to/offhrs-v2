import { adminSessionCookieOptions, getAdminCookieName, verifyAdmin } from '@/lib/admin-auth'
import { logSecurityEvent } from '@/lib/security-monitor'
import { getRateLimitKey } from '@/lib/rate-limit'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/admin/logout
 * Clears the admin session cookie so the user must log in again.
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
    ...adminSessionCookieOptions(request),
    maxAge: 0,
  })
  return res
}

