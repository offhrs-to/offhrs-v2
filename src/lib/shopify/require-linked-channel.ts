import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  channelCanManageLinkedShop,
  resolveChannelAuth,
  type ChannelAuth,
} from '@/lib/shopify/channel-auth'
import { setChannelShopCookie } from '@/lib/shopify/channel-session-cookie'
import {
  loadShopifyShopByDomain,
  type ShopifyShopRow,
} from '@/lib/shopify/sync-workshops'

type VendorRow = { id: string; business_name: string | null; user_id: string }

export type LinkedChannelContext = {
  auth: ChannelAuth
  admin: NonNullable<ReturnType<typeof createAdminClient>>
  shop: string
  shopRow: ShopifyShopRow
  vendor: VendorRow
}

function unauthorized(): NextResponse {
  const res = NextResponse.json(
    { error: 'Open this app from Shopify Admin, or sign in to offhrs.' },
    { status: 401 }
  )
  // App Bridge fetches a fresh ID token and retries once.
  res.headers.set('X-Shopify-Retry-Invalid-Session-Request', '1')
  return res
}

/**
 * Require a Shopify Admin ID token (or partner session) that owns this linked shop.
 */
export async function requireLinkedChannelShop(
  request: NextRequest,
  shop: string
): Promise<LinkedChannelContext | NextResponse> {
  const auth = await resolveChannelAuth(request, shop)
  if (!auth) return unauthorized()

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  const shopRow = await loadShopifyShopByDomain(admin, shop)
  if (!shopRow) {
    return NextResponse.json({ error: 'Connect your offhrs account first.' }, { status: 403 })
  }

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id, business_name, user_id')
    .eq('id', shopRow.vendor_id)
    .maybeSingle()

  if (!vendor?.user_id) {
    return NextResponse.json({ error: 'Partner account required.' }, { status: 403 })
  }

  if (!channelCanManageLinkedShop(auth, shop, shopRow.vendor_id, vendor.user_id)) {
    return NextResponse.json(
      { error: 'Shop is not linked to this partner.' },
      { status: 403 }
    )
  }

  return {
    auth,
    admin,
    shop,
    shopRow,
    vendor: {
      id: vendor.id,
      business_name: vendor.business_name,
      user_id: vendor.user_id,
    },
  }
}

/** Attach sticky channel cookie after a successful authenticated mutation. */
export function withChannelShopCookie(res: NextResponse, shop: string): NextResponse {
  setChannelShopCookie(res, shop)
  return res
}
