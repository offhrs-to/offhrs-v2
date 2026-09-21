import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import {
  isMarketplaceDashboardPath,
  isNativeOnlyDashboardPath,
  vendorHasNativePartnerPlan,
} from '@/lib/partner-access'
import { vendorHasMarketplaceAccess } from '@/lib/shop/access'
import { normalizeShopDomain, shopDomainFromHostParam } from '@/lib/shopify/shop-domain'
import { verifyShopifySessionToken } from '@/lib/shopify/session-token'
import { setChannelShopCookie } from '@/lib/shopify/channel-session-cookie'

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

const SHOPIFY_FRAME_ANCESTORS =
  "frame-ancestors https://admin.shopify.com https://*.myshopify.com https://admin.shopify.io;"

function withFrameAncestors(response: NextResponse, pathname: string): NextResponse {
  const isShopifyEmbed = pathname === '/shopify' || pathname.startsWith('/shopify/')
  response.headers.set(
    'Content-Security-Policy',
    isShopifyEmbed ? SHOPIFY_FRAME_ANCESTORS : "frame-ancestors 'none';"
  )
  return response
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Tag embedded Shopify Admin requests for root layout (no marketing chrome / framing).
  const requestHeaders = new Headers(request.headers)
  if (pathname === '/shopify' || pathname.startsWith('/shopify/')) {
    requestHeaders.set('x-offhrs-shopify-admin', '1')
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // Preview/misconfigured deploys: never crash the edge with missing env.
  if (!supabaseUrl || !supabaseAnonKey) {
    return withFrameAncestors(supabaseResponse, pathname)
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request: { headers: requestHeaders },
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // Refresh the session token (keeps consumer auth alive)
  let user: { sub?: string } | null = null
  try {
    const { data } = await supabase.auth.getClaims()
    user = data?.claims ?? null
  } catch (err) {
    console.error('proxy auth getClaims failed:', err)
    return withFrameAncestors(supabaseResponse, pathname)
  }

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
      return withFrameAncestors(supabaseResponse, pathname)
    }

    const isPublicPartnerPath = PUBLIC_PARTNER_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + '/')
    )

    if (isPublicPartnerPath) {
      return withFrameAncestors(supabaseResponse, pathname)
    }

    // Must be authenticated — preserve full path so Shopify connect popup returns here.
    if (!user) {
      const url = request.nextUrl.clone()
      const returnTo = `${pathname}${request.nextUrl.search}`
      url.pathname = '/partners/login'
      url.search = ''
      if (returnTo.startsWith('/') && !returnTo.startsWith('//')) {
        url.searchParams.set('next', returnTo)
      }
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
      pathname.startsWith('/partners/dashboard/faq') ||
      pathname.startsWith('/partners/dashboard/marketplace') ||
      pathname.startsWith('/partners/shopify-connect')

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

    // Pending vendors must complete Stripe billing OR Shopify Sync / Marketplace onboarding.
    if (vendor.status === 'pending') {
      if (pathname === '/partners/checkout' || pathname.startsWith('/partners/checkout/')) {
        return withFrameAncestors(supabaseResponse, pathname)
      }
      if (pathname === '/partners/shopify-sync' || pathname.startsWith('/partners/shopify-sync/')) {
        return withFrameAncestors(supabaseResponse, pathname)
      }
      // Allow Sync / Marketplace path into dashboard/settings/faq/marketplace before Stripe.
      if (shopifyOnboardingPaths) {
        return withFrameAncestors(supabaseResponse, pathname)
      }
      const url = request.nextUrl.clone()
      url.pathname = '/partners/signup'
      url.searchParams.set('billing', '1')
      return NextResponse.redirect(url)
    }

    if (!activeStatuses.includes(vendor.status)) {
      // Suspended/canceled: allow Settings if they still have a Shopify shop (manage Sync billing).
      if (pathname === '/partners/suspended' || pathname.startsWith('/partners/suspended/')) {
        return withFrameAncestors(supabaseResponse, pathname)
      }
      if (
        pathname.startsWith('/partners/dashboard/settings') &&
        (await vendorHasShopifyShop(vendor.id))
      ) {
        return withFrameAncestors(supabaseResponse, pathname)
      }
      const url = request.nextUrl.clone()
      url.pathname = '/partners/suspended'
      return NextResponse.redirect(url)
    }

    // Marketplace tab requires Lite/Pro or marketplace enrollment.
    if (isMarketplaceDashboardPath(pathname)) {
      const admin = adminClient()
      const hasMarketplace = admin ? await vendorHasMarketplaceAccess(admin, vendor.id) : false
      if (!hasMarketplace) {
        const url = request.nextUrl.clone()
        url.pathname = '/partners/dashboard'
        return NextResponse.redirect(url)
      }
    }

    // Sync-only / Marketplace-only (no Lite/Pro): block workshop native tabs.
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

  // Mint partitioned channel cookie on the HTML response when Shopify provides id_token.
  // This is the most reliable path for Sync/Disconnect auth in the Admin iframe.
  if (pathname === '/shopify' || pathname.startsWith('/shopify/')) {
    const idToken = request.nextUrl.searchParams.get('id_token')
    const shop =
      normalizeShopDomain(request.nextUrl.searchParams.get('shop')) ??
      shopDomainFromHostParam(request.nextUrl.searchParams.get('host'))
    if (idToken && shop) {
      const session = verifyShopifySessionToken(idToken, { expectedShop: shop })
      if (session) {
        setChannelShopCookie(supabaseResponse, session.shop)
      }
    }
  }

  return withFrameAncestors(supabaseResponse, pathname)
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
