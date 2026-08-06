import { createHmac, timingSafeEqual } from 'crypto'
import { SHOPIFY_API_VERSION, SHOPIFY_OAUTH_SCOPES_DEFAULT } from './conventions'

export function shopifyApiKey(): string | null {
  return process.env.SHOPIFY_API_KEY?.trim() || null
}

export function shopifyApiSecret(): string | null {
  return process.env.SHOPIFY_API_SECRET?.trim() || null
}

export function shopifyOauthScopes(): string {
  return process.env.SHOPIFY_SCOPES?.trim() || SHOPIFY_OAUTH_SCOPES_DEFAULT
}

/** Normalize to `store.myshopify.com` (lowercase). Returns null if invalid. */
export function normalizeShopDomain(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  let shop = raw.trim().toLowerCase()
  shop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (shop.includes('/')) shop = shop.split('/')[0] ?? shop
  if (!shop.includes('.')) shop = `${shop}.myshopify.com`
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) return null
  return shop
}

export function shopifyAuthorizeUrl(opts: {
  shop: string
  clientId: string
  scopes: string
  redirectUri: string
  state: string
}): string {
  const u = new URL(`https://${opts.shop}/admin/oauth/authorize`)
  u.searchParams.set('client_id', opts.clientId)
  u.searchParams.set('scope', opts.scopes)
  u.searchParams.set('redirect_uri', opts.redirectUri)
  u.searchParams.set('state', opts.state)
  return u.toString()
}

/**
 * Verify Shopify OAuth callback query HMAC.
 * https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant
 */
export function verifyShopifyOAuthHmac(
  searchParams: URLSearchParams,
  apiSecret: string
): boolean {
  const hmac = searchParams.get('hmac')
  if (!hmac) return false
  const entries: string[] = []
  searchParams.forEach((value, key) => {
    if (key === 'hmac' || key === 'signature') return
    entries.push(`${key}=${value}`)
  })
  entries.sort()
  const message = entries.join('&')
  const digest = createHmac('sha256', apiSecret).update(message).digest('hex')
  try {
    const a = Buffer.from(digest, 'utf8')
    const b = Buffer.from(hmac, 'utf8')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export type ShopifyAccessTokenResult = {
  access_token: string
  scope: string
  /** Seconds until access token expires; omitted for legacy non-expiring tokens. */
  expires_in?: number
  refresh_token?: string
  /** Seconds until refresh token expires (~90 days). */
  refresh_token_expires_in?: number
}

/**
 * Exchange authorization code for an offline Admin API token.
 * Requests an expiring offline token (`expiring=1`) per Shopify Dec 2025+ requirements.
 * https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/offline-access-tokens
 */
export async function exchangeShopifyAccessToken(opts: {
  shop: string
  clientId: string
  clientSecret: string
  code: string
}): Promise<ShopifyAccessTokenResult> {
  const body = new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    code: opts.code,
    expiring: '1',
  })
  const res = await fetch(`https://${opts.shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Shopify token exchange failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    access_token?: string
    scope?: string
    expires_in?: number
    refresh_token?: string
    refresh_token_expires_in?: number
  }
  if (!data.access_token) throw new Error('Shopify token exchange missing access_token')
  return {
    access_token: data.access_token,
    scope: data.scope ?? '',
    expires_in: typeof data.expires_in === 'number' ? data.expires_in : undefined,
    refresh_token: data.refresh_token,
    refresh_token_expires_in:
      typeof data.refresh_token_expires_in === 'number' ? data.refresh_token_expires_in : undefined,
  }
}

/** Refresh an expiring offline access token. Returns a new access + refresh token pair. */
export async function refreshShopifyOfflineToken(opts: {
  shop: string
  clientId: string
  clientSecret: string
  refreshToken: string
}): Promise<ShopifyAccessTokenResult> {
  const body = new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: opts.refreshToken,
  })
  const res = await fetch(`https://${opts.shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Shopify token refresh failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    access_token?: string
    scope?: string
    expires_in?: number
    refresh_token?: string
    refresh_token_expires_in?: number
  }
  if (!data.access_token) throw new Error('Shopify token refresh missing access_token')
  return {
    access_token: data.access_token,
    scope: data.scope ?? '',
    expires_in: typeof data.expires_in === 'number' ? data.expires_in : undefined,
    refresh_token: data.refresh_token,
    refresh_token_expires_in:
      typeof data.refresh_token_expires_in === 'number' ? data.refresh_token_expires_in : undefined,
  }
}

/**
 * One-time migration: exchange a legacy non-expiring offline token for an expiring one.
 * Irreversible for that shop install.
 */
export async function migrateShopifyOfflineTokenToExpiring(opts: {
  shop: string
  clientId: string
  clientSecret: string
  nonExpiringAccessToken: string
}): Promise<ShopifyAccessTokenResult> {
  const body = new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: opts.nonExpiringAccessToken,
    subject_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
    requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
    expiring: '1',
  })
  const res = await fetch(`https://${opts.shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Shopify token migration failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    access_token?: string
    scope?: string
    expires_in?: number
    refresh_token?: string
    refresh_token_expires_in?: number
  }
  if (!data.access_token) throw new Error('Shopify token migration missing access_token')
  return {
    access_token: data.access_token,
    scope: data.scope ?? '',
    expires_in: typeof data.expires_in === 'number' ? data.expires_in : undefined,
    refresh_token: data.refresh_token,
    refresh_token_expires_in:
      typeof data.refresh_token_expires_in === 'number' ? data.refresh_token_expires_in : undefined,
  }
}

export function shopifyGidToNumericId(gid: string | null | undefined): string | null {
  if (!gid) return null
  const m = String(gid).match(/\/(\d+)\s*$/)
  return m?.[1] ?? null
}

export function numericIdToGid(resource: 'Product' | 'ProductVariant' | 'InventoryItem', id: string): string {
  return `gid://shopify/${resource}/${id}`
}

export async function shopifyAdminGraphql<T>(opts: {
  shop: string
  accessToken: string
  query: string
  variables?: Record<string, unknown>
}): Promise<T> {
  const res = await fetch(
    `https://${opts.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': opts.accessToken,
      },
      body: JSON.stringify({ query: opts.query, variables: opts.variables }),
    }
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Shopify GraphQL HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> }
  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL: ${json.errors.map((e) => e.message).join('; ')}`)
  }
  if (!json.data) throw new Error('Shopify GraphQL returned no data')
  return json.data
}

export async function shopifyAdminRest<T>(opts: {
  shop: string
  accessToken: string
  method?: string
  path: string
  body?: unknown
}): Promise<T> {
  const method = opts.method ?? 'GET'
  const res = await fetch(`https://${opts.shop}/admin/api/${SHOPIFY_API_VERSION}${opts.path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Shopify-Access-Token': opts.accessToken,
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Shopify REST ${method} ${opts.path} → ${res.status}: ${text.slice(0, 300)}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
