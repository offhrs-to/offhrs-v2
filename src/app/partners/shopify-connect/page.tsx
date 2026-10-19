'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Link,
  BlockStack,
  Text,
} from '@shopify/polaris'
import { createClient } from '@/lib/supabase/browser'
import { finishShopifyConnectPopup } from '@/lib/shopify/finish-popup'
import { PARTNER_CLICKWRAP_LINKS } from '@/lib/legal-acceptances-client'
import { shopifyChannelLoginHref } from '@/lib/shopify/channel-signup'
import { ShopifyChannelPolarisFrame } from '@/components/shopify/ShopifyChannelPolarisFrame'

function ShopifyConnectInner() {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')?.trim() ?? ''
  const host = searchParams.get('host')?.trim() ?? ''
  const [error, setError] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const loginHref = shopifyChannelLoginHref({
    get(name: string) {
      if (name === 'from') return 'shopify_channel'
      if (name === 'shopify_shop') return shop
      if (name === 'next') {
        if (!shop) return null
        const next = `/partners/shopify-connect?shop=${encodeURIComponent(shop)}${
          host ? `&host=${encodeURIComponent(host)}` : ''
        }`
        return next
      }
      return null
    },
  })

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
        window.location.replace(loginHref)
        return
      }

      if (!cancelled) setSessionReady(true)
    }

    void ensureSession()
    return () => {
      cancelled = true
    }
  }, [shop, loginHref])

  async function startConnect() {
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
  }

  return (
    <ShopifyChannelPolarisFrame>
      <Text as="h1" variant="headingLg">
        Connect offhrs
      </Text>
      {error ? (
        <Banner tone="critical" title="Connection needs attention">
          <p>{error}</p>
        </Banner>
      ) : null}
      {!shop ? (
        <Link url={loginHref}>Back to sign in</Link>
      ) : !sessionReady ? (
        <Card>
          <Text as="p" variant="bodyMd">
            {error ? 'Sign in to continue.' : 'Checking your partner session…'}
          </Text>
        </Card>
      ) : (
        <Card>
          <BlockStack gap="400">
            <Text as="p" variant="bodyMd">
              Linking {shop} requires accepting the partner terms. Each document opens in a new window.
            </Text>
            <BlockStack gap="100">
              {PARTNER_CLICKWRAP_LINKS.map((doc) => (
                <Link key={doc.key} url={doc.href} target="_blank">
                  {doc.title}
                </Link>
              ))}
            </BlockStack>
            <Checkbox
              label="I agree to the Terms of Use, Privacy Policy, Data Protection Addendum, and Marketplace Seller Addendum."
              checked={acceptTerms}
              onChange={setAcceptTerms}
            />
            <Button
              variant="primary"
              fullWidth
              disabled={!acceptTerms}
              loading={connecting}
              onClick={() => void startConnect()}
            >
              Accept and connect
            </Button>
          </BlockStack>
        </Card>
      )}
    </ShopifyChannelPolarisFrame>
  )
}

export default function PartnerShopifyConnectPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: '#f1f1f1', padding: 24 }}>
          <p>Connecting…</p>
        </div>
      }
    >
      <ShopifyConnectInner />
    </Suspense>
  )
}
