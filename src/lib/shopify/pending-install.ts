import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { encrypt } from '@/lib/token-encryption'
import type { ShopifyAccessTokenResult } from './admin-client'

type Admin = SupabaseClient

const PENDING_TTL_MS = 60 * 60 * 1000 // 1 hour

export type ShopifyPendingInstallRow = {
  id: string
  shop_domain: string
  access_token_encrypted: string
  refresh_token_encrypted: string | null
  access_token_expires_at: string | null
  refresh_token_expires_at: string | null
  scope: string | null
  claim_token: string
  expires_at: string
}

/** Store (or replace) tokens until a signed-in vendor claims the shop. */
export async function upsertShopifyPendingInstall(
  admin: Admin,
  opts: {
    shopDomain: string
    tokens: ShopifyAccessTokenResult
  }
): Promise<{ claimToken: string }> {
  const now = Date.now()
  const claimToken = randomBytes(24).toString('base64url')
  const expiresAt = new Date(now + PENDING_TTL_MS).toISOString()
  const accessExpires =
    typeof opts.tokens.expires_in === 'number'
      ? new Date(now + opts.tokens.expires_in * 1000).toISOString()
      : null
  const refreshExpires =
    typeof opts.tokens.refresh_token_expires_in === 'number'
      ? new Date(now + opts.tokens.refresh_token_expires_in * 1000).toISOString()
      : null

  const row = {
    shop_domain: opts.shopDomain,
    access_token_encrypted: encrypt(opts.tokens.access_token),
    refresh_token_encrypted: opts.tokens.refresh_token ? encrypt(opts.tokens.refresh_token) : null,
    access_token_expires_at: accessExpires,
    refresh_token_expires_at: refreshExpires,
    scope: opts.tokens.scope,
    claim_token: claimToken,
    expires_at: expiresAt,
    created_at: new Date(now).toISOString(),
  }

  const { error } = await admin.from('shopify_pending_installs').upsert(row, {
    onConflict: 'shop_domain',
  })
  if (error) throw new Error(`shopify_pending_installs upsert failed: ${error.message}`)
  return { claimToken }
}

export async function loadShopifyPendingByClaimToken(
  admin: Admin,
  claimToken: string
): Promise<ShopifyPendingInstallRow | null> {
  const { data, error } = await admin
    .from('shopify_pending_installs')
    .select(
      'id, shop_domain, access_token_encrypted, refresh_token_encrypted, access_token_expires_at, refresh_token_expires_at, scope, claim_token, expires_at'
    )
    .eq('claim_token', claimToken)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await admin.from('shopify_pending_installs').delete().eq('id', data.id)
    return null
  }
  return data as ShopifyPendingInstallRow
}

export async function deleteShopifyPendingInstall(admin: Admin, id: string): Promise<void> {
  await admin.from('shopify_pending_installs').delete().eq('id', id)
}
