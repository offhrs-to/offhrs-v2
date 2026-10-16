'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { OffhrsLogoLink } from '@/components/offhrs-logo'
import { createClient } from '@/lib/supabase/browser'
import { finishShopifyConnectPopup } from '@/lib/shopify/finish-popup'
import { PARTNER_CLICKWRAP_LINKS } from '@/lib/legal-acceptances-client'

function ShopifyConnectInner() {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')?.trim() ?? ''
  const host = searchParams.get('host')?.trim() ?? ''
  const [error, setError] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function ensureSession() {
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

      if (!cancelled) setSessionReady(true)
    }

    void ensureSession()
    return () => {
      cancelled = true
    }
  }, [shop, host])

  const startConnect = useCallback(async () => {
    if (!shop || !acceptTerms || connecting) return
    setConnecting(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setError('Session expired. Sign in again.')
        setConnecting(false)
        return
      }

      const acceptRes = await fetch('/api/partners/legal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accepted: true, context: 'shopify_connect' }),
      })
      const acceptData = (await acceptRes.json()) as { error?: string }
      if (!acceptRes.ok) {
        setError(acceptData.error ?? 'Could not record Terms acceptance.')
        setConnecting(false)
        return
      }

      const res = await fetch('/api/shopify/channel/start-oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ shop, host: host || undefined, popup: true, terms_accepted: true }),
      })
      const data = (await res.json()) as {
        authorizeUrl?: string
        doneUrl?: string
        alreadyLinked?: boolean
        error?: string
      }
      if (!res.ok) {
        setError(data.error ?? 'Could not start Shopify connection.')
        setConnecting(false)
        return
      }
      if (data.doneUrl || data.alreadyLinked) {
        const notified = await finishShopifyConnectPopup({ shop })
        if (!notified && data.doneUrl) {
          window.location.assign(data.doneUrl)
        }
        return
      }
      if (!data.authorizeUrl) {
        setError(data.error ?? 'Could not start Shopify connection.')
        setConnecting(false)
        return
      }
      window.location.assign(data.authorizeUrl)
    } catch {
      setError('Network error starting Shopify connection.')
      setConnecting(false)
    }
  }, [shop, host, acceptTerms, connecting])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[#FAFAF8]">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-[#E8E6E0] bg-white p-8 shadow-sm">
        <OffhrsLogoLink
          href="/partners"
          linkClassName="inline-flex justify-center w-full"
          className="h-9 w-auto max-w-[170px] object-contain mx-auto"
          width={200}
          height={48}
        />
        {error ? (
          <>
            <p className="text-sm text-red-700 text-center">{error}</p>
            <Link href="/partners/login" className="block text-center text-sm text-[#5D755D] underline">
              Back to sign in
            </Link>
          </>
        ) : !sessionReady ? (
          <p className="text-sm text-[#555] text-center">Checking your partner session…</p>
        ) : (
          <>
            <div className="space-y-2 text-center">
              <h1 className="font-playfair text-xl font-bold text-[#1a1a1a]">Connect Shopify</h1>
              <p className="text-sm text-[#555] leading-relaxed">
                Linking <span className="font-medium text-[#1a1a1a]">{shop}</span> requires accepting
                our partner Terms.
              </p>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-left text-sm text-[#555]">
              {PARTNER_CLICKWRAP_LINKS.map((doc) => (
                <li key={doc.key}>
                  <a
                    href={doc.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#5D755D] underline"
                  >
                    {doc.title}
                  </a>
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-3 cursor-pointer text-left">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#D9D7CF] text-[#5D755D] focus:ring-[#5D755D]"
              />
              <span className="text-sm text-[#1a1a1a] leading-relaxed">
                I agree to the Terms of Use, Privacy Policy, Data Protection Addendum, and Marketplace
                Seller Addendum.
              </span>
            </label>
            <button
              type="button"
              disabled={!acceptTerms || connecting}
              onClick={() => void startConnect()}
              className="w-full rounded-lg bg-[#5D755D] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4d634d] disabled:opacity-40 disabled:pointer-events-none"
            >
              {connecting ? 'Connecting…' : 'Accept and connect'}
            </button>
          </>
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
