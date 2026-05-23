import type { NextRequest } from 'next/server'

/**
 * Base URL for calendar OAuth (redirect_uri + post-auth redirects).
 * 1) Prefer `x-forwarded-host` + `x-forwarded-proto` (Vercel / proxies) so the
 *    value matches the URL users see in the browser (avoids redirect_uri_mismatch).
 * 2) Then `nextUrl.origin` (Next canonical URL for this request).
 * 3) Fall back to env so local/dev without forwarded headers still works.
 */
export function calendarOAuthAppBase(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const protoHeader = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (host) {
    const proto = protoHeader === 'http' || protoHeader === 'https' ? protoHeader : 'https'
    return `${proto}://${host}`.replace(/\/$/, '')
  }
  try {
    return request.nextUrl.origin.replace(/\/$/, '')
  } catch {
    // fall through
  }
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ).replace(/\/$/, '')
}
