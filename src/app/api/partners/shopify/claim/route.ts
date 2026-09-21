import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { shopifyOAuthAppBase } from '@/lib/shopify/app-base'
import { shopifyChannelHomeUrl } from '@/lib/shopify/channel-home'
import {
  deleteShopifyPendingInstall,
  loadShopifyPendingByClaimToken,
} from '@/lib/shopify/pending-install'
import { claimPendingInstallForVendor } from '@/lib/shopify/claim-pending-install'

/**
 * Attach a pending Shopify install (tokens from OAuth-before-login) to the
 * signed-in partner vendor. Lands on embedded channel home when return_to is set.
 */
export async function GET(request: NextRequest) {
  const base = shopifyOAuthAppBase(request)
  const claimToken = request.nextUrl.searchParams.get('token')?.trim()
  const returnTo = request.nextUrl.searchParams.get('return_to')?.trim()
  if (!claimToken) {
    return NextResponse.redirect(`${base}/shopify?shopify_error=missing_claim`)
  }

  const finish = (query: string, shopDomain?: string) => {
    if (returnTo && returnTo.startsWith(base)) {
      const u = new URL(returnTo)
      const q = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query)
      q.forEach((v, k) => u.searchParams.set(k, v))
      return NextResponse.redirect(u.toString())
    }
    if (shopDomain) {
      return NextResponse.redirect(
        shopifyChannelHomeUrl(request, { shop: shopDomain, query })
      )
    }
    return NextResponse.redirect(`${base}/shopify?${query}`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const login = new URL(`${base}/partners/login`)
    const next = `/api/partners/shopify/claim?token=${encodeURIComponent(claimToken)}${
      returnTo ? `&return_to=${encodeURIComponent(returnTo)}` : ''
    }`
    login.searchParams.set('next', next)
    return NextResponse.redirect(login.toString())
  }

  const admin = createAdminClient()
  if (!admin) return finish('shopify_error=server')

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id, business_name')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!vendor) {
    return finish('shopify_error=vendor_required')
  }

  try {
    const pending = await loadShopifyPendingByClaimToken(admin, claimToken)
    if (!pending) {
      return finish('shopify_error=claim_expired')
    }

    const result = await claimPendingInstallForVendor({
      admin,
      vendorId: vendor.id,
      businessName: vendor.business_name,
      shopDomain: pending.shop_domain,
      callbackBaseUrl: base,
      pending,
    })

    if (!result.claimed) {
      if (result.reason === 'shop_already_linked') {
        return finish('shopify_error=shop_already_linked', pending.shop_domain)
      }
      await deleteShopifyPendingInstall(admin, pending.id).catch(() => {})
      return finish('shopify_error=claim_expired', pending.shop_domain)
    }

    return finish('shopify_connected=1', pending.shop_domain)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'claim_failed'
    console.error('[shopify] claim', e)
    return finish(`shopify_error=${encodeURIComponent(msg.slice(0, 120))}`)
  }
}
