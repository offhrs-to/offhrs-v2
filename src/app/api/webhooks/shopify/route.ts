import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeShopDomain } from '@/lib/shopify/admin-client'
import { verifyShopifyWebhookHmac } from '@/lib/shopify/verify-webhook'
import {
  ensureVendorActiveForShopifySync,
  mapShopifySubscriptionStatus,
  persistShopifyBillingStatus,
  shopifyBillingAllowsSync,
} from '@/lib/shopify/billing'
import {
  applyShopifyInventoryLevel,
  archiveShopifyProductEvents,
  disconnectShopifyShopByDomain,
  loadShopifyShopByDomain,
  syncShopifyProductByNumericId,
} from '@/lib/shopify/sync-workshops'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const hmac = request.headers.get('x-shopify-hmac-sha256')
  if (!verifyShopifyWebhookHmac(rawBody, hmac)) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 })
  }

  const topic = request.headers.get('x-shopify-topic') ?? 'unknown'
  const shopHeader = request.headers.get('x-shopify-shop-domain')
  const shop = normalizeShopDomain(shopHeader)
  const webhookId =
    request.headers.get('x-shopify-webhook-id') ||
    request.headers.get('x-shopify-event-id') ||
    `${shop ?? 'unknown'}:${topic}:${createHmacishId(rawBody)}`

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  // Mandatory compliance webhooks (Partner Dashboard → Compliance).
  if (
    topic === 'customers/data_request' ||
    topic === 'customers/redact' ||
    topic === 'shop/redact'
  ) {
    const { data: existingCompliance } = await admin
      .from('webhook_events')
      .select('id')
      .eq('event_id', webhookId)
      .maybeSingle()
    if (!existingCompliance) {
      await admin.from('webhook_events').insert({
        source: 'shopify',
        event_id: webhookId,
        event_type: topic,
        payload: safeJson(rawBody),
        processed_at: new Date().toISOString(),
      })
    }

    if (topic === 'shop/redact' && shop) {
      try {
        await disconnectShopifyShopByDomain(admin, shop)
      } catch (err) {
        console.error('[shopify webhook] shop/redact:', err)
      }
    }

    return NextResponse.json({ received: true })
  }

  if (!shop) {
    return NextResponse.json({ error: 'Missing shop domain' }, { status: 400 })
  }

  const { data: existing } = await admin
    .from('webhook_events')
    .select('id')
    .eq('event_id', webhookId)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    payload = { raw: rawBody.slice(0, 500) }
  }

  await admin.from('webhook_events').insert({
    source: 'shopify',
    event_id: webhookId,
    event_type: topic,
    payload,
  })

  try {
    const shopRow = await loadShopifyShopByDomain(admin, shop)
    if (!shopRow) {
      await admin
        .from('webhook_events')
        .update({ processed_at: new Date().toISOString(), error: 'shop_not_linked' })
        .eq('event_id', webhookId)
      return NextResponse.json({ received: true, skipped: true })
    }

    if (topic === 'app_subscriptions/update') {
      const statusRaw = String(payload.status ?? '')
      const gid =
        (typeof payload.admin_graphql_api_id === 'string' && payload.admin_graphql_api_id) ||
        (payload.id != null ? `gid://shopify/AppSubscription/${payload.id}` : null)
      const billingStatus = mapShopifySubscriptionStatus(statusRaw)
      await persistShopifyBillingStatus(admin, shopRow.id, {
        billingStatus,
        appSubscriptionGid: gid,
      })
      if (billingStatus === 'active') {
        await ensureVendorActiveForShopifySync(admin, shopRow.vendor_id)
      }
      await admin
        .from('webhook_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('event_id', webhookId)
      return NextResponse.json({ received: true })
    }

    // App Store 1.2.2: clear local billing on uninstall so reinstall can request a new charge.
    if (topic === 'app/uninstalled') {
      await persistShopifyBillingStatus(admin, shopRow.id, {
        billingStatus: 'cancelled',
        appSubscriptionGid: null,
      })
      await admin
        .from('webhook_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('event_id', webhookId)
      return NextResponse.json({ received: true })
    }

    if (
      !shopRow.sync_enabled ||
      !shopifyBillingAllowsSync({
        billingStatus: shopRow.billing_status,
        shopDomain: shopRow.shop_domain,
      })
    ) {
      await admin
        .from('webhook_events')
        .update({ processed_at: new Date().toISOString(), error: 'sync_not_entitled' })
        .eq('event_id', webhookId)
      return NextResponse.json({ received: true, skipped: true })
    }

    if (topic === 'products/create' || topic === 'products/update') {
      const productId = String(payload.id ?? '')
      if (productId) {
        await syncShopifyProductByNumericId(admin, shopRow, productId)
      }
    } else if (topic === 'products/delete') {
      const productId = String(payload.id ?? '')
      if (productId) {
        await archiveShopifyProductEvents(admin, shopRow.vendor_id, productId)
      }
    } else if (topic === 'inventory_levels/update') {
      const inventoryItemId = payload.inventory_item_id
      const available = payload.available
      if (inventoryItemId != null && typeof available === 'number') {
        await applyShopifyInventoryLevel(admin, String(inventoryItemId), available)
      }
    }

    await admin
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('event_id', webhookId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[shopify webhook] ${topic}:`, err)
    await admin
      .from('webhook_events')
      .update({ error: message })
      .eq('event_id', webhookId)
  }

  return NextResponse.json({ received: true })
}

function safeJson(rawBody: string): Record<string, unknown> {
  try {
    return JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return { raw: rawBody.slice(0, 500) }
  }
}

function createHmacishId(rawBody: string): string {
  let h = 0
  for (let i = 0; i < rawBody.length; i++) h = (Math.imul(31, h) + rawBody.charCodeAt(i)) | 0
  return `body:${h}:${rawBody.length}`
}
