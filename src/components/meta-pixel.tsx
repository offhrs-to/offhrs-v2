'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { META_PIXEL_ID, readAdConsent } from '@/lib/ad-consent'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
    _fbq?: unknown
  }
}

/**
 * Loads the Meta Pixel only after the visitor accepts advertising cookies.
 * Listens for `offhrs-ad-consent` so Accept on the banner can init without reload.
 */
export function MetaPixel() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const sync = () => setEnabled(readAdConsent() === 'accepted')
    sync()
    window.addEventListener('offhrs-ad-consent', sync)
    return () => window.removeEventListener('offhrs-ad-consent', sync)
  }, [])

  if (!enabled) return null

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
    </Script>
  )
}
