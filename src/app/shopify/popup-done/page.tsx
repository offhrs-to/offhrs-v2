'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { finishShopifyConnectPopup } from '@/lib/shopify/finish-popup'

function PopupDoneInner() {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop') ?? ''
  const host = searchParams.get('host') ?? ''
  const err = searchParams.get('shopify_error')
  const [stuck, setStuck] = useState(false)

  const channelHome = useMemo(() => {
    const p = new URLSearchParams()
    if (shop) p.set('shop', shop)
    if (host) p.set('host', host)
    if (err) p.set('shopify_error', err)
    else p.set('shopify_connected', '1')
    return `/shopify?${p.toString()}`
  }, [shop, host, err])

  useEffect(() => {
    let cancelled = false
    let stuckTimer: number | undefined

    async function finish() {
      const notified = await finishShopifyConnectPopup({
        shop,
        error: err,
      })
      if (cancelled) return
      if (notified) {
        stuckTimer = window.setTimeout(() => {
          if (!cancelled) setStuck(true)
        }, 600)
        return
      }
      window.location.replace(channelHome)
    }

    void finish()
    return () => {
      cancelled = true
      if (stuckTimer) window.clearTimeout(stuckTimer)
    }
  }, [shop, err, channelHome])

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, textAlign: 'center' }}>
      <p>{err ? 'Connection failed.' : 'Connected. You can close this window.'}</p>
      {stuck || err ? (
        <p style={{ marginTop: 12 }}>
          <a href={channelHome}>Continue</a>
        </p>
      ) : null}
    </div>
  )
}

export default function ShopifyPopupDonePage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Finishing…</div>}>
      <PopupDoneInner />
    </Suspense>
  )
}
