'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { OffhrsLogoLink } from '@/components/offhrs-logo'
import { createClient } from '@/lib/supabase/browser'
import { finishShopifyConnectPopup } from '@/lib/shopify/finish-popup'

function ShopifyConnectInner() {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')?.trim() ?? ''
  const host = searchParams.get('host')?.trim() ?? ''
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!shop) {
        setError('Missing shop. Close this window and open Connect from Shopify Admin.')
        return
      }

      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        const next = `/partners/shopify-connect?shop=${encodeURIComponent(shop)}${
          host ? `&host=${encodeURIComponent(host)}` : ''
        }`
        window.location.replace(
          `/partners/login?next=${encodeURIComponent(next)}&shopify_shop=${encodeURIComponent(shop)}`
        )
        return
      }

      try {
        const res = await fetch('/api/shopify/channel/start-oauth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          credentials: 'include',
          body: JSON.stringify({ shop, host: host || undefined, popup: true }),
        })
        const data = (await res.json()) as {
          authorizeUrl?: string
          doneUrl?: string
          alreadyLinked?: boolean
          error?: string
        }
        if (!res.ok) {
          if (!cancelled) setError(data.error ?? 'Could not start Shopify connection.')
          return
        }
        // Already linked — hand session into Admin iframe without another navigation.
        if (data.doneUrl || data.alreadyLinked) {
          const notified = await finishShopifyConnectPopup({ shop })
          if (!notified && data.doneUrl) {
            window.location.assign(data.doneUrl)
          }
          return
        }
        if (!data.authorizeUrl) {
          if (!cancelled) setError(data.error ?? 'Could not start Shopify connection.')
          return
        }
        window.location.assign(data.authorizeUrl)
      } catch {
        if (!cancelled) setError('Network error starting Shopify connection.')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [shop, host])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6 text-center">
        <OffhrsLogoLink
          href="/partners"
          linkClassName="inline-flex justify-center"
          className="h-9 w-auto max-w-[170px] object-contain mx-auto"
          width={200}
          height={48}
        />
        {error ? (
          <>
            <p className="text-sm text-red-700">{error}</p>
            <Link href="/partners/login" className="text-sm text-[#5D755D] underline">
              Back to sign in
            </Link>
          </>
        ) : (
          <p className="text-sm text-[#555]">Connecting your Shopify store…</p>
        )}
      </div>
    </div>
  )
}

export default function PartnerShopifyConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center px-4 py-10">
          <p className="text-sm text-[#555]">Connecting…</p>
        </div>
      }
    >
      <ShopifyConnectInner />
    </Suspense>
  )
}
