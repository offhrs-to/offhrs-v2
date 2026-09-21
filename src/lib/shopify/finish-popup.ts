import {
  SHOPIFY_POPUP_CONNECTED_MESSAGE,
  type ShopifyPopupConnectedMessage,
} from '@/lib/shopify/popup-session'
import { createClient } from '@/lib/supabase/browser'

export const SHOPIFY_CONNECT_BROADCAST = 'offhrs-shopify-connect'

async function readSessionTokens(): Promise<{
  access_token?: string
  refresh_token?: string
}> {
  const supabase = createClient()
  // One quick read — avoid multi-second polling that delays popup close.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.access_token && session.refresh_token) {
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }
  }
  return {}
}

/**
 * Hand the partner session into the Shopify Admin iframe, then close.
 */
export async function finishShopifyConnectPopup(opts: {
  shop: string
  error?: string | null
}): Promise<boolean> {
  const origin = window.location.origin
  const payload: ShopifyPopupConnectedMessage = {
    type: SHOPIFY_POPUP_CONNECTED_MESSAGE,
    shop: opts.shop,
    error: opts.error || null,
  }

  if (!opts.error) {
    try {
      Object.assign(payload, await readSessionTokens())
    } catch {
      // Still notify opener.
    }
  }

  let deliveredToOpener = false

  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(payload, origin)
      deliveredToOpener = true
    } catch {
      // ignore
    }
  }

  try {
    const bc = new BroadcastChannel(SHOPIFY_CONNECT_BROADCAST)
    bc.postMessage(payload)
    bc.close()
  } catch {
    // ignore
  }

  if (deliveredToOpener) {
    window.close()
    return true
  }

  // Opener often null after Shopify OAuth — still try close; Admin will poll status.
  window.close()
  return false
}
