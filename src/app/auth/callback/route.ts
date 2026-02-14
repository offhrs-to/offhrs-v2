import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MOBILE_APP_SCHEME = 'offhrsmobile://auth/callback'

function isMobileUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false
  const ua = userAgent.toLowerCase()
  return /iphone|ipad|ipod|android|webos|mobile|iemobile|blackberry/i.test(ua)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const { searchParams, origin } = url
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/profile'
  const userAgent = request.headers.get('user-agent')

  // On mobile, serve a page that redirects to the app with the full URL (query + hash).
  // The server never sees the hash, so we must use client-side JS to pass it (e.g. Supabase may send #access_token=...).
  if (isMobileUserAgent(userAgent)) {
    const appUrlEscaped = (MOBILE_APP_SCHEME + url.search).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>var q=location.search,h=location.hash;if(q||h)window.location.replace(${JSON.stringify(MOBILE_APP_SCHEME)}+q+h);</script></head><body><p>Opening app…</p><p><a href="${appUrlEscaped}">Tap here if the app didn't open</a></p></body></html>`
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_failed`)
}
