import { verifyAdmin } from '@/app/api/admin/login/route'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/session
 * Returns 200 if the request has a valid admin session cookie (so the client
 * can restore isAuthenticated without showing the login form on navigation).
 */
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
