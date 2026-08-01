import { createHmac, timingSafeEqual } from 'crypto'
import { shopifyApiSecret } from './admin-client'

/** Verify Shopify webhook HMAC (base64 digest of raw body). */
export function verifyShopifyWebhookHmac(rawBody: string, hmacHeader: string | null): boolean {
  const secret = shopifyApiSecret()
  if (!secret || !hmacHeader) return false
  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  try {
    const a = Buffer.from(digest)
    const b = Buffer.from(hmacHeader)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}
