import { NextRequest, NextResponse } from 'next/server'
import { normalizeShopDomain } from '@/lib/shopify/admin-client'
import { requireLinkedChannelShop } from '@/lib/shopify/require-linked-channel'
import { clearChannelShopCookie } from '@/lib/shopify/channel-session-cookie'
import { disconnectVendorShopify } from '@/lib/shopify/sync-workshops'
import { deleteOffhrsChannelConnection } from '@/lib/shopify/channel-connection'

/** Disconnect offhrs account from this shop (Sales Channel AccountConnection). */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { shop?: string }
  const shop = normalizeShopDomain(body.shop)
  if (!shop) {
    return NextResponse.json({ error: 'Missing shop' }, { status: 400 })
  }

  const ctx = await requireLinkedChannelShop(request, shop)
  if (ctx instanceof NextResponse) return ctx
  const { admin, shopRow, vendor } = ctx

  try {
    await deleteOffhrsChannelConnection(admin, shopRow)
    await disconnectVendorShopify(admin, vendor.id)
    const res = NextResponse.json({ ok: true })
    clearChannelShopCookie(res)
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Disconnect failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
