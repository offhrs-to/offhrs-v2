/** Marks a partner signup that started from the Shopify sales channel. */
export const SHOPIFY_CHANNEL_SIGNUP_COOKIE = 'offhrs_shopify_channel_signup'

const STORAGE_KEY = 'offhrs_shopify_channel_signup'
const MAX_AGE_SECONDS = 60 * 60 * 2
const MAX_AGE_MS = MAX_AGE_SECONDS * 1000

type ChannelSignupParams = {
  get(name: string): string | null
}

export type StoredShopifyChannelSignup = {
  next: string | null
  shop: string | null
  at: number
}

/** Internal return path only — the Shopify connect popup. */
export function safeShopifyConnectNext(next: string | null | undefined): string | null {
  if (!next) return null
  if (!next.startsWith('/') || next.startsWith('//')) return null
  if (next.includes('\\') || next.includes('\n') || next.includes('\r')) return null
  let url: URL
  try {
    url = new URL(next, 'https://offhrs.local')
  } catch {
    return null
  }
  if (url.origin !== 'https://offhrs.local') return null
  if (url.pathname !== '/partners/shopify-connect') return null
  return `${url.pathname}${url.search}`
}

export function safeShopifyShop(shop: string | null | undefined): string | null {
  const value = shop?.trim() ?? ''
  if (!value || value.length > 255) return null
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(value)) return null
  return value
}

export function isShopifyChannelSignup(params: ChannelSignupParams): boolean {
  if (params.get('from') === 'shopify_channel') return true
  if (safeShopifyShop(params.get('shopify_shop'))) return true
  return safeShopifyConnectNext(params.get('next')) != null
}

/** Signup URL used by partner login when the session started in the Shopify channel. */
export function buildShopifyChannelSignupHref(params: ChannelSignupParams): string | null {
  if (!isShopifyChannelSignup(params)) return null
  const q = new URLSearchParams()
  q.set('intent', 'shopify_sync')
  q.set('from', 'shopify_channel')
  const shop = safeShopifyShop(params.get('shopify_shop'))
  const next = safeShopifyConnectNext(params.get('next'))
  if (shop) q.set('shopify_shop', shop)
  if (next) q.set('next', next)
  return `/partners/signup?${q.toString()}`
}

export function readShopifyChannelSignup(): StoredShopifyChannelSignup | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredShopifyChannelSignup
    if (!parsed || typeof parsed.at !== 'number' || Date.now() - parsed.at > MAX_AGE_MS) {
      clearShopifyChannelSignup()
      return null
    }
    return {
      next: safeShopifyConnectNext(parsed.next),
      shop: safeShopifyShop(parsed.shop),
      at: parsed.at,
    }
  } catch {
    return null
  }
}

export function rememberShopifyChannelSignup(input: { next: string | null; shop: string | null }) {
  if (typeof window === 'undefined') return
  const prev = readShopifyChannelSignup()
  const payload: StoredShopifyChannelSignup = {
    next: input.next ?? prev?.next ?? null,
    shop: input.shop ?? prev?.shop ?? null,
    at: Date.now(),
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${SHOPIFY_CHANNEL_SIGNUP_COOKIE}=1; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`
}

export function clearShopifyChannelSignup() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  document.cookie = `${SHOPIFY_CHANNEL_SIGNUP_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

export function shopifyChannelLoginHref(
  params: ChannelSignupParams,
  stored?: { next: string | null; shop: string | null } | null
): string {
  const q = new URLSearchParams()
  q.set('from', 'shopify_channel')
  const shop = safeShopifyShop(params.get('shopify_shop')) ?? stored?.shop ?? null
  const next = safeShopifyConnectNext(params.get('next')) ?? stored?.next ?? null
  if (shop) q.set('shopify_shop', shop)
  if (next) q.set('next', next)
  return `/partners/login?${q.toString()}`
}
