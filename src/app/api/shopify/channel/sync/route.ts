import { NextRequest, NextResponse } from 'next/server'
import { normalizeShopDomain } from '@/lib/shopify/admin-client'
import {
  refreshShopifyBillingFromAdmin,
  shopifyBillingAllowsSync,
} from '@/lib/shopify/billing'
import { bootstrapOffhrsChannelFeeds } from '@/lib/shopify/bootstrap-channel'
import {
  requireLinkedChannelShop,
  withChannelShopCookie,
} from '@/lib/shopify/require-linked-channel'
import { triggerOffhrsChannelFullSync } from '@/lib/shopify/channel-connection'
import {
  getValidShopAccessToken,
  loadShopifyShopByDomain,
  syncPublishedChannelProductsForShop,
} from '@/lib/shopify/sync-workshops'

/**
 * Kick a channel full sync (published catalog) + direct channel product pull + tag fallback.
 * Used from Sales Channel Admin “Sync published products”.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { shop?: string }
  const shop = normalizeShopDomain(body.shop)
  if (!shop) {
    return NextResponse.json({ error: 'Missing shop' }, { status: 400 })
  }

  const ctx = await requireLinkedChannelShop(request, shop)
  if (ctx instanceof NextResponse) return ctx
  const { admin, vendor } = ctx
  let shopRow = ctx.shopRow

  let billingOk = shopifyBillingAllowsSync({
    billingStatus: shopRow.billing_status,
    shopDomain: shopRow.shop_domain,
  })

  // Reconnect / reinstall can leave billing_status stale while Shopify still has an active trial.
  if (!billingOk) {
    try {
      const accessToken = await getValidShopAccessToken(admin, shopRow)
      const refreshed = await refreshShopifyBillingFromAdmin({
        admin,
        shopId: shopRow.id,
        vendorId: vendor.id,
        shopDomain: shopRow.shop_domain,
        accessToken,
      })
      billingOk = refreshed === 'active'
      if (billingOk) {
        shopRow = (await loadShopifyShopByDomain(admin, shop)) ?? shopRow
      }
    } catch (e) {
      console.error('[shopify] billing refresh before sync', e)
    }
  }

  if (!billingOk) {
    return NextResponse.json(
      {
        error: 'Approve Shopify Sync billing first.',
        needs_billing: true,
      },
      { status: 402 }
    )
  }

  try {
    await bootstrapOffhrsChannelFeeds(admin, shopRow, {
      accountName: vendor.business_name,
      // Direct product pull below is the source of truth — don't await a duplicate feed sync.
      triggerFullSync: false,
    })

    const fresh = await loadShopifyShopByDomain(admin, shop)
    if (!fresh?.shopify_channel_gid) {
      return NextResponse.json(
        {
          error:
            'Could not create the offhrs channel connection. Ensure the store has a Canada market with Online Store, then try Sync again.',
          channel_gid: null,
        },
        { status: 422 }
      )
    }

    // Kick Shopify feed sync in the background; don't block the merchant UI on it.
    void triggerOffhrsChannelFullSync(admin, fresh).then((feed) => {
      if (!feed.ok) console.error('[shopify] channel sync API', feed.error)
    })

    // Publish-only: do not fall back to tag sync (would resurrect unpublished products).
    const published = await syncPublishedChannelProductsForShop(admin, fresh)
    const found = published.total_product_ids
    const upserted = published.upserted
    const skipped = published.skipped

    if (found === 0) {
      return withChannelShopCookie(
        NextResponse.json({
          ok: true,
          warning:
            'Shopify reports 0 products published to offhrs. Open the product → Publishing (sliders) → enable offhrs specifically (not only Online Store / Shop / POS), Save, then Sync again.',
          channel_gid: fresh.shopify_channel_gid,
          feed_ok: true,
          published,
          upserted,
          skipped,
          skipped_no_datetime: skipped,
        }),
        shop
      )
    }

    if (upserted === 0) {
      return withChannelShopCookie(
        NextResponse.json({
          ok: true,
          warning: `Found ${found} published product(s) (${published.sample_titles.slice(0, 2).join('; ') || 'untitled'}) but 0 sessions synced (${skipped} skipped — usually missing session date/time). Each variant needs a full date+time like "September 30, 2026 12:00 PM", or metafield offhrs.starts_at. Details also appear as product feedback in Shopify Admin.`,
          channel_gid: fresh.shopify_channel_gid,
          feed_ok: true,
          published,
          upserted,
          skipped,
          skipped_no_datetime: skipped,
        }),
        shop
      )
    }

    return withChannelShopCookie(
      NextResponse.json({
        ok: true,
        channel_gid: fresh.shopify_channel_gid,
        feed_ok: true,
        feed_error: null,
        published,
        upserted,
        skipped,
        skipped_no_datetime: skipped,
      }),
      shop
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Sync failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
