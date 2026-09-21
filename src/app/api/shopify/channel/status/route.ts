import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import {
  normalizeShopDomain,
  shopDomainFromHostParam,
  shopHasStorefrontTokenScope,
} from '@/lib/shopify/admin-client'
import {
  shopifyBillingAllowsSync,
  isShopifySyncCompedShop,
  refreshShopifyBillingFromAdmin,
} from '@/lib/shopify/billing'
import {
  channelCanManageLinkedShop,
  resolveChannelAuth,
} from '@/lib/shopify/channel-auth'
import { setChannelShopCookie } from '@/lib/shopify/channel-session-cookie'
import { SHOPIFY_SYNC_PLAN_LABEL, SHOPIFY_SYNC_MONTHLY_CAD } from '@/lib/partner-pricing'
import {
  shopifyAdminBulkPublicationsUrl,
  shopifyAdminProductsUrl,
} from '@/lib/shopify/conventions'
import {
  getValidShopAccessToken,
  loadShopifyShopByDomain,
} from '@/lib/shopify/sync-workshops'

/**
 * Sales channel Admin status — keyed by shop domain.
 * Accepts `shop` or Shopify `host` (base64). Optional `refresh_billing=1` pulls
 * subscription state from Shopify after Start trial return.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const shop =
    normalizeShopDomain(sp.get('shop')) ?? shopDomainFromHostParam(sp.get('host'))
  if (!shop) {
    return NextResponse.json({ error: 'Missing shop' }, { status: 400 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  const wantBillingRefresh = sp.get('refresh_billing') === '1'

  const [{ data: shopRow }, auth] = await Promise.all([
    admin
      .from('vendor_shopify_shops')
      .select(
        'vendor_id, shop_domain, scope, sync_enabled, last_synced_at, installed_at, billing_status, billing_confirmed_at, shopify_channel_gid, shopify_channel_handle'
      )
      .eq('shop_domain', shop)
      .maybeSingle(),
    resolveChannelAuth(request, shop),
  ])

  if (!shopRow) {
    return NextResponse.json({
      connected: false,
      session_matches: false,
      plan_label: SHOPIFY_SYNC_PLAN_LABEL,
      plan_amount_cad: SHOPIFY_SYNC_MONTHLY_CAD,
    })
  }

  const [{ data: vendor }, { count }] = await Promise.all([
    admin
      .from('vendor_profiles')
      .select('id, business_name, user_id')
      .eq('id', shopRow.vendor_id)
      .maybeSingle(),
    admin
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_profile_id', shopRow.vendor_id)
      .eq('listing_source', 'shopify')
      .neq('booking_status', 'archived'),
  ])

  const sessionMatches = Boolean(
    auth &&
      vendor?.user_id &&
      channelCanManageLinkedShop(auth, shop, shopRow.vendor_id, vendor.user_id)
  )

  let billingStatus = shopRow.billing_status
  let billingActive = shopifyBillingAllowsSync({
    billingStatus,
    shopDomain: shopRow.shop_domain,
  })

  // After Start trial return, Shopify may lag — refresh when asked or still pending.
  // Do not require session_matches: billing truth comes from the shop offline token.
  if (!billingActive && (wantBillingRefresh || billingStatus === 'pending')) {
    try {
      const full = await loadShopifyShopByDomain(admin, shop)
      if (full) {
        const accessToken = await getValidShopAccessToken(admin, full)
        const refreshed = await refreshShopifyBillingFromAdmin({
          admin,
          shopId: full.id,
          vendorId: full.vendor_id,
          shopDomain: full.shop_domain,
          accessToken,
        })
        billingStatus = refreshed
        billingActive = refreshed === 'active'
      }
    } catch (e) {
      console.error('[shopify] status billing refresh', e)
    }
  }

  const res = NextResponse.json({
    connected: true,
    session_matches: sessionMatches,
    shop_domain: shopRow.shop_domain,
    scope: shopRow.scope,
    sync_enabled: shopRow.sync_enabled,
    last_synced_at: shopRow.last_synced_at,
    installed_at: shopRow.installed_at,
    synced_session_count: count ?? 0,
    published_session_count: count ?? 0,
    channel_connected: Boolean(shopRow.shopify_channel_gid),
    channel_gid: shopRow.shopify_channel_gid ?? null,
    products_admin_url: shopifyAdminProductsUrl(shopRow.shop_domain),
    bulk_publications_url: shopifyAdminBulkPublicationsUrl(shopRow.shop_domain),
    billing_status: billingStatus ?? 'none',
    billing_active: billingActive,
    billing_confirmed_at: shopRow.billing_confirmed_at,
    billing_comped: isShopifySyncCompedShop(shopRow.shop_domain),
    plan_label: SHOPIFY_SYNC_PLAN_LABEL,
    plan_amount_cad: SHOPIFY_SYNC_MONTHLY_CAD,
    partner_business_name: sessionMatches
      ? (vendor?.business_name ?? null)
      : shopRow
        ? (vendor?.business_name ?? null)
        : null,
    partner_email: null,
    needs_scope_update: !shopHasStorefrontTokenScope(shopRow.scope),
    granted_scope: shopRow.scope ?? null,
  })

  if (sessionMatches) {
    setChannelShopCookie(res, shop)
  }

  return res
}
