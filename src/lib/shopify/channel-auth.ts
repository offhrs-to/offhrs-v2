import type { User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeShopDomain } from '@/lib/shopify/admin-client'
import { readChannelShopCookie } from '@/lib/shopify/channel-session-cookie'
import {
  extractShopifySessionToken,
  verifyShopifySessionToken,
} from '@/lib/shopify/session-token'

export type ChannelAuth =
  | {
      kind: 'shopify'
      shop: string
    }
  | {
      kind: 'partner'
      user: User
    }

async function partnerUserFromJwt(token: string): Promise<User | null> {
  const admin = createAdminClient()
  if (!admin) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

/**
 * Resolve auth for sales-channel Admin API calls.
 * Order: Shopify ID token → sticky channel cookie → partner JWT/cookies.
 */
export async function resolveChannelAuth(
  request: NextRequest,
  expectedShop?: string | null
): Promise<ChannelAuth | null> {
  const shopHint = normalizeShopDomain(expectedShop)

  const candidate = extractShopifySessionToken(request)
  if (candidate) {
    const session = verifyShopifySessionToken(candidate, { expectedShop: shopHint })
    if (session) {
      return { kind: 'shopify', shop: session.shop }
    }

    const partner = await partnerUserFromJwt(candidate)
    if (partner) return { kind: 'partner', user: partner }
  }

  const cookieShop = readChannelShopCookie(request)
  if (cookieShop && (!shopHint || cookieShop === shopHint)) {
    return { kind: 'shopify', shop: cookieShop }
  }

  const offhrs = request.headers
    .get('x-offhrs-authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim()
  if (offhrs) {
    const partner = await partnerUserFromJwt(offhrs)
    if (partner) return { kind: 'partner', user: partner }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) return { kind: 'partner', user }

  return null
}

export function channelCanManageLinkedShop(
  auth: ChannelAuth,
  shop: string,
  _vendorId: string,
  vendorUserId: string
): boolean {
  if (auth.kind === 'shopify') {
    return auth.shop === shop
  }
  return auth.user.id === vendorUserId
}

export async function getChannelRequestUser(
  request: NextRequest
): Promise<User | null> {
  const auth = await resolveChannelAuth(request)
  if (auth?.kind === 'partner') return auth.user
  return null
}
