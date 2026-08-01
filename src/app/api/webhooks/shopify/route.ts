import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeShopDomain } from '@/lib/shopify/admin-client'
import { verifyShopifyWebhookHmac } from '@/lib/shopify/verify-webhook'
import {
  applyShopifyInventoryLevel,
  archiveShopifyProductEvents,
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

  if (!shop) {
    return NextResponse.json({ error: 'Missing shop domain' }, { status: 400 })
  }

  // Idempotency
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
    if (!shopRow || !shopRow.sync_enabled) {
      await admin
        .from('webhook_events')
        .update({ processed_at: new Date().toISOString(), error: 'shop_not_linked' })
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

function createHmacishId(rawBody: string): string {
  // Fallback uniqueness when Shopify omits webhook id header
  let h = 0
  for (let i = 0; i < rawBody.length; i++) h = (Math.imul(31, h) + rawBody.charCodeAt(i)) | 0
  return `body:${h}:${rawBody.length}`
}
