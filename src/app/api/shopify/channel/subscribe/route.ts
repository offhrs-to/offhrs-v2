import { NextRequest, NextResponse } from 'next/server'
import { normalizeShopDomain } from '@/lib/shopify/admin-client'
import { shopifyOAuthAppBase } from '@/lib/shopify/app-base'
import {
  requireLinkedChannelShop,
  withChannelShopCookie,
} from '@/lib/shopify/require-linked-channel'
import {
  createShopifySyncSubscription,
  persistShopifyBillingStatus,
  refreshShopifyBillingFromAdmin,
  shopifyBillingAllowsSync,
} from '@/lib/shopify/billing'
import { getValidShopAccessToken } from '@/lib/shopify/sync-workshops'

/** Start Sync billing from the embedded sales channel Admin UI. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { shop?: string; host?: string }
  const shop = normalizeShopDomain(body.shop)
  const host = typeof body.host === 'string' ? body.host : ''
  if (!shop) {
    return NextResponse.json({ error: 'Missing shop' }, { status: 400 })
  }

  const ctx = await requireLinkedChannelShop(request, shop)
  if (ctx instanceof NextResponse) return ctx
  const { admin, shopRow, vendor } = ctx

  if (
    shopifyBillingAllowsSync({
      billingStatus: shopRow.billing_status,
      shopDomain: shopRow.shop_domain,
    })
  ) {
    return withChannelShopCookie(
      NextResponse.json({ error: 'Sync plan already active.', alreadyActive: true }, { status: 400 }),
      shop
    )
  }

  try {
    const accessToken = await getValidShopAccessToken(admin, shopRow)

    // First approval may have succeeded on Shopify while our DB stayed pending
    // (billing callback used to require a partner cookie). Reconcile before creating another charge.
    const refreshed = await refreshShopifyBillingFromAdmin({
      admin,
      shopId: shopRow.id,
      vendorId: vendor.id,
      shopDomain: shopRow.shop_domain,
      accessToken,
    })
    if (refreshed === 'active') {
      return withChannelShopCookie(
        NextResponse.json({ alreadyActive: true, billing_status: 'active' }),
        shop
      )
    }

    const base = shopifyOAuthAppBase(request)
    const returnParams = new URLSearchParams({ shop })
    if (host) returnParams.set('host', host)
    const returnUrl = `${base}/api/partners/shopify/billing/callback?${returnParams.toString()}`

    const { confirmationUrl, subscriptionGid } = await createShopifySyncSubscription({
      shop: shopRow.shop_domain,
      accessToken,
      returnUrl,
    })

    await persistShopifyBillingStatus(admin, shopRow.id, {
      billingStatus: 'pending',
      appSubscriptionGid: subscriptionGid,
    })

    return withChannelShopCookie(NextResponse.json({ confirmationUrl }), shop)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'subscribe_failed'
    console.error('[shopify channel] subscribe', e)
    return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 })
  }
}
