import type { NextRequest } from 'next/server'

/**
 * Base URL for calendar OAuth (redirect_uri + post-auth redirects).
 * Uses the incoming request origin first so branch previews
 * (`*-git-*-*.vercel.app`) are not replaced by the project's default
 * `VERCEL_URL` / mis-set `NEXT_PUBLIC_APP_URL` (often the non-git hostname).
 */
export function calendarOAuthAppBase(request: NextRequest): string {
  try {
    const origin = new URL(request.url).origin
    if (origin && origin !== 'null') return origin.replace(/\/$/, '')
  } catch {
    // fall through
  }
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ).replace(/\/$/, '')
}
