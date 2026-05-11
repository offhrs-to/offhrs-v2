import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PARTNER_PATHS = [
  '/partners/login',
  '/partners/signup',
  '/partners/verify-email',
  '/partners/reset-password',
  '/partners/auth/callback',
]

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session token (keeps consumer auth alive)
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  const { pathname } = request.nextUrl

  // ── Admin: Basic Auth protection ────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    const adminUser = process.env.ADMIN_USER
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminUser || !adminPassword) {
      return new NextResponse('Admin credentials not configured', { status: 500 })
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Basic ')) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
      })
    }

    try {
      const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8')
      const [username, password] = credentials.split(':')
      if (!username || !password || username !== adminUser || password !== adminPassword) {
        return new NextResponse('Invalid credentials', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
        })
      }
    } catch {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
      })
    }
  }

  // ── Consumer: protect /profile ──────────────────────────────────────────────
  if (!user && pathname.startsWith('/profile')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // ── Vendor portal: /partners/* protection ───────────────────────────────────
  if (pathname.startsWith('/partners')) {
    // Public marketing landing — must not require auth or checkout (same as /partners/login, etc.)
    if (pathname === '/partners' || pathname === '/partners/') {
      return supabaseResponse
    }

    const isPublicPartnerPath = PUBLIC_PARTNER_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + '/')
    )

    if (isPublicPartnerPath) {
      return supabaseResponse
    }

    // Must be authenticated
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/partners/login'
      return NextResponse.redirect(url)
    }

    // Must have an active/trialing/past_due subscription
    const { data: vendor } = await supabase
      .from('vendor_profiles')
      .select('status')
      .eq('user_id', user.sub)
      .single()

    const activeStatuses = ['trialing', 'active', 'past_due']

    if (!vendor) {
      // Authenticated user but no vendor profile → send to signup
      const url = request.nextUrl.clone()
      url.pathname = '/partners/signup'
      return NextResponse.redirect(url)
    }

    // Pending vendors must complete billing checkout first.
    // Allow checkout route while blocking all other dashboard pages.
    if (vendor.status === 'pending') {
      if (pathname === '/partners/checkout' || pathname.startsWith('/partners/checkout/')) {
        return supabaseResponse
      }
      const url = request.nextUrl.clone()
      url.pathname = '/partners/checkout'
      return NextResponse.redirect(url)
    }

    if (!activeStatuses.includes(vendor.status)) {
      // Suspended or canceled → locked page
      const url = request.nextUrl.clone()
      url.pathname = '/partners/suspended'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
