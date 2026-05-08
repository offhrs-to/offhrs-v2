import { getAdminCookieName } from '@/app/api/admin/login/route'
import { NextResponse } from 'next/server'

/**
 * POST /api/admin/logout
 * Clears the admin session cookie so the user must log in again.
 */
export async function POST() {
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

