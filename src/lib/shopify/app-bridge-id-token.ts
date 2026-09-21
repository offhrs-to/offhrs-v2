/** App Bridge CDN global (shopifycloud/app-bridge.js). */
export type ShopifyAppBridgeGlobal = {
  idToken: () => Promise<string>
}

declare global {
  interface Window {
    shopify?: ShopifyAppBridgeGlobal
  }
}

let bridgeReady: Promise<boolean> | null = null

function waitForAppBridge(timeoutMs: number): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.shopify?.idToken) return Promise.resolve(true)

  if (!bridgeReady) {
    bridgeReady = new Promise((resolve) => {
      const started = Date.now()
      const tick = () => {
        if (window.shopify?.idToken) {
          resolve(true)
          return
        }
        if (Date.now() - started >= timeoutMs) {
          bridgeReady = null
          resolve(false)
          return
        }
        window.setTimeout(tick, 50)
      }
      tick()
    })
  }
  return bridgeReady
}

/**
 * Fresh Shopify Admin ID token.
 * IMPORTANT: `idToken()` can hang forever if the api-key meta was empty at
 * App Bridge init — always race with a timeout.
 */
export async function getShopifyIdToken(timeoutMs = 4000): Promise<string | null> {
  const waitBudget = Math.min(2000, Math.max(500, Math.floor(timeoutMs / 2)))
  const ready = await waitForAppBridge(waitBudget)
  if (!ready || !window.shopify?.idToken) return null

  const callBudget = Math.max(500, timeoutMs - waitBudget)
  try {
    return await Promise.race([
      window.shopify.idToken().then((t) => t || null),
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), callBudget)
      }),
    ])
  } catch {
    return null
  }
}

export function clearShopifyIdTokenCache(): void {
  bridgeReady = null
}
