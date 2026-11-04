'use client'

import { useEffect } from 'react'

/** Shopify App URL may still point at `/` — forward install/open handoff to OAuth bootstrap. */
export function ShopifyAppHandoff() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const shop = params.get('shop')
    const hmac = params.get('hmac')
    if (!shop || !hmac) return
    if (!shop.includes('myshopify.com')) return
    window.location.replace(`/api/partners/shopify/app?${params.toString()}`)
  }, [])
  return null
}
