import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import {
  isNativeOnlyDashboardPath,
  vendorHasNativePartnerPlan,
} from '@/lib/partner-access'

const PUBLIC_PARTNER_PATHS = [
  '/partners/login',
  '/partners/signup',
  '/partners/verify-email',
  '/partners/reset-password',
  '/partners/auth/callback',
  '/partners/update-password',
  '/partners/shopify-sync',
]

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

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

  // ── Admin: the /admin page itself is a client component that shows a login
  // form (cookie-session based, via /api/admin/login) when unauthenticated,
  // same pattern as /partners/login. All actual data access is gated
  // server-side per-route by verifyAdmin() (cookie-only — see src/lib/admin-auth.ts).

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

    // Must have an active/trialing/past_due subscription — or Shopify Sync onboarding access.
    const { data: vendor } = await supabase
      .from('vendor_profiles')
      .select('id, status')
      .eq('user_id', user.sub)
      .single()

    const activeStatuses = ['trialing', 'active', 'past_due']

    if (!vendor) {
      // Authenticated user but no vendor profile → send to signup
      const url = request.nextUrl.clone()
      url.pathname = '/partners/signup'
      return NextResponse.redirect(url)
    }

    const shopifyOnboardingPaths =
      pathname.startsWith('/partners/dashboard/settings') ||
      pathname === '/partners/dashboard' ||
      pathname === '/partners/dashboard/' ||
      pathname.startsWith('/partners/dashboard/faq')

    async function vendorHasShopifyShop(vendorId: string): Promise<boolean> {
      const admin = adminClient()
      if (!admin) return false
      const { data: shop } = await admin
        .from('vendor_shopify_shops')
        .select('id')
        .eq('vendor_id', vendorId)
        .maybeSingle()
      return Boolean(shop)
    }

    // Pending vendors must complete Stripe billing OR Shopify Sync onboarding (guide → install → Settings).
    if (vendor.status === 'pending') {
      if (pathname === '/partners/checkout' || pathname.startsWith('/partners/checkout/')) {
        return supabaseResponse
      }
      if (pathname === '/partners/shopify-sync' || pathname.startsWith('/partners/shopify-sync/')) {
        return supabaseResponse
      }
      // Allow Sync path into dashboard/settings/faq before Stripe (install + claim happens here).
      if (shopifyOnboardingPaths) {
        return supabaseResponse
      }
      const url = request.nextUrl.clone()
      url.pathname = '/partners/signup'
      url.searchParams.set('billing', '1')
      return NextResponse.redirect(url)
    }

    if (!activeStatuses.includes(vendor.status)) {
      // Suspended/canceled: allow Settings if they still have a Shopify shop (manage Sync billing).
      if (pathname === '/partners/suspended' || pathname.startsWith('/partners/suspended/')) {
        return supabaseResponse
      }
      if (
        pathname.startsWith('/partners/dashboard/settings') &&
        (await vendorHasShopifyShop(vendor.id))
      ) {
        return supabaseResponse
      }
      const url = request.nextUrl.clone()
      url.pathname = '/partners/suspended'
      return NextResponse.redirect(url)
    }

    // Sync-only (no Lite/Pro): Overview, Settings, FAQ only — hide bookings/workshops/etc.
    if (isNativeOnlyDashboardPath(pathname)) {
      const admin = adminClient()
      const hasNative = admin ? await vendorHasNativePartnerPlan(admin, vendor.id) : false
      if (!hasNative) {
        const url = request.nextUrl.clone()
        url.pathname = '/partners/dashboard/settings'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Run on page navigations only. Skip `/api/*` so Route Handler Set-Cookie
     * (e.g. admin_session on /api/admin/login) is not interfered with by the
     * Supabase session refresh response rewriting.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
