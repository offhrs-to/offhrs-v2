import type { NextRequest } from 'next/server'

/** Base URL for Shopify OAuth redirect_uri and post-auth redirects. */
export function shopifyOAuthAppBase(request: NextRequest): string {
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
