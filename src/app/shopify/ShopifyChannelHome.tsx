'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AccountConnection,
  AppProvider,
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Layout,
  Link,
  Page,
  Text,
} from '@shopify/polaris'
import enTranslations from '@shopify/polaris/locales/en.json'
import '@shopify/polaris/build/esm/styles.css'
import { SHOPIFY_SYNC_PLAN_LABEL, PARTNER_TRIAL_LABEL } from '@/lib/partner-pricing'
import { createClient } from '@/lib/supabase/browser'
import { shopDomainFromHostParam } from '@/lib/shopify/shop-domain'
import { getShopifyIdToken } from '@/lib/shopify/app-bridge-id-token'
import {
  SHOPIFY_POPUP_CONNECTED_MESSAGE,
  type ShopifyPopupConnectedMessage,
} from '@/lib/shopify/popup-session'
import { SHOPIFY_CONNECT_BROADCAST } from '@/lib/shopify/finish-popup'

type ChannelStatus = {
  connected: boolean
  session_matches?: boolean
  shop_domain?: string
  billing_status?: string
  billing_active?: boolean
  billing_comped?: boolean
  synced_session_count?: number
  published_session_count?: number
  channel_connected?: boolean
  products_admin_url?: string
  bulk_publications_url?: string
  last_synced_at?: string | null
  plan_label?: string
  partner_business_name?: string | null
  partner_email?: string | null
  needs_scope_update?: boolean
}

type LastSyncSummary = {
  upserted: number
  skipped: number
  warning?: string
}

type Props = {
  apiKey: string
  shop: string
  host: string
  idTokenQuery: string | null
  connectedQuery: string | null
  billingQuery: string | null
  errorQuery: string | null
}

export function ShopifyChannelHome(props: Props) {
  const { host, connectedQuery, billingQuery, errorQuery, idTokenQuery } = props
  const shop = props.shop || shopDomainFromHostParam(host) || ''
  const [status, setStatus] = useState<ChannelStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [flash, setFlash] = useState<{ tone: 'success' | 'critical' | 'info'; text: string } | null>(
    null
  )
  const [urlIdToken] = useState(idTokenQuery)
  const [lastSyncSummary, setLastSyncSummary] = useState<LastSyncSummary | null>(null)

  const channelFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers)

      // Prefer App Bridge; fall back to URL id_token (Shopify often includes it on embed open).
      const shopifyToken = (await getShopifyIdToken(8000)) || urlIdToken
      if (shopifyToken) {
        headers.set('Authorization', `Bearer ${shopifyToken}`)
        headers.set('X-Shopify-Session-Token', shopifyToken)
      } else {
        // Leave Authorization unset so App Bridge's fetch interceptor can inject the ID token.
        try {
          const supabase = createClient()
          const {
            data: { session },
          } = await supabase.auth.getSession()
          if (session?.access_token) {
            headers.set('X-Offhrs-Authorization', `Bearer ${session.access_token}`)
          }
        } catch {
          // ignore
        }
      }

      return fetch(input, {
        ...init,
        credentials: 'include',
        headers,
      })
    },
    [urlIdToken]
  )

  /** Exchange Shopify ID token for sticky channel cookie (fixes Retry / Sync 401). */
  const ensureChannelSession = useCallback(async (): Promise<{
    ok: boolean
    reason?: string
    error?: string
  }> => {
    if (!shop) return { ok: false, reason: 'missing_shop' }
    // Give App Bridge more time on explicit Retry; URL token is an instant fallback.
    const token = (await getShopifyIdToken(10000)) || urlIdToken
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      // Prefer an explicit token; if missing, leave Authorization unset so App Bridge
      // can inject one (previous code returned false before fetch — Retry did nothing).
      if (token) {
        headers.Authorization = `Bearer ${token}`
        headers['X-Shopify-Session-Token'] = token
      }
      const res = await fetch('/api/shopify/channel/session', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ shop, host: host || undefined }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { reason?: string; error?: string }
        console.warn('[shopify] channel session bootstrap failed', data.reason ?? res.status)
        return {
          ok: false,
          reason: data.reason ?? `http_${res.status}`,
          error: data.error,
        }
      }
      return { ok: true }
    } catch {
      return { ok: false, reason: 'network' }
    }
  }, [shop, host, urlIdToken])

  const loadStatus = useCallback(
    async (opts?: {
      refreshBilling?: boolean
      bootstrapSession?: boolean
      showAuthErrors?: boolean
    }) => {
      if (!shop) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        let boot: { ok: boolean; reason?: string; error?: string } | null = null
        if (opts?.bootstrapSession !== false) {
          boot = await ensureChannelSession()
        }
        const qs = new URLSearchParams({ shop })
        if (host) qs.set('host', host)
        if (opts?.refreshBilling) qs.set('refresh_billing', '1')
        const res = await channelFetch(`/api/shopify/channel/status?${qs.toString()}`)
        const data = (await res.json()) as ChannelStatus & { error?: string }
        if (!res.ok) {
          setStatus({ connected: false })
          setFlash({ tone: 'critical', text: data.error ?? 'Could not load channel status.' })
        } else {
          setStatus(data)
          if (data.connected && !data.session_matches) {
            const retryBoot = await ensureChannelSession()
            if (retryBoot.ok) {
              const res2 = await channelFetch(`/api/shopify/channel/status?${qs.toString()}`)
              if (res2.ok) {
                const data2 = (await res2.json()) as ChannelStatus
                setStatus(data2)
                if (data2.session_matches) return
              }
            }
            if (opts?.showAuthErrors) {
              const reason = retryBoot.reason || boot?.reason
              setFlash({
                tone: 'critical',
                text:
                  reason === 'invalid_token'
                    ? 'Shopify Admin token was rejected. Soft-refresh this page (Shopify Admin reload), then tap Retry again.'
                    : reason === 'missing_token'
                      ? 'Could not reach Shopify App Bridge. Soft-refresh this Sales channel page, wait 2 seconds, then tap Retry.'
                      : 'Still authorizing. Soft-refresh this page once, then tap Retry.',
              })
            }
          }
        }
      } catch {
        setFlash({ tone: 'critical', text: 'Network error loading channel status.' })
      } finally {
        setLoading(false)
      }
    },
    [shop, host, channelFetch, ensureChannelSession]
  )

  useEffect(() => {
    if (props.apiKey) {
      let meta = document.querySelector('meta[name="shopify-api-key"]')
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('name', 'shopify-api-key')
        document.head.prepend(meta)
      }
      if (!meta.getAttribute('content')) {
        meta.setAttribute('content', props.apiKey)
      }
    }
    void loadStatus({ refreshBilling: true })
  }, [loadStatus, props.apiKey, billingQuery])

  useEffect(() => {
    async function applyPopupSession(data: ShopifyPopupConnectedMessage) {
      if (data.error) {
        setFlash({ tone: 'critical', text: decodeURIComponent(String(data.error)) })
        return
      }

      // For already-linked shops, Shopify ID token is enough — just refresh status.
      const shopifyToken = await getShopifyIdToken()
      if (shopifyToken) {
        await loadStatus()
        if (!data.access_token) {
          setFlash({ tone: 'success', text: 'Connected. You can sync now.' })
          return
        }
      }

      if (!data.access_token || !data.refresh_token) {
        await loadStatus()
        return
      }

      try {
        const supabase = createClient()
        const { error } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })
        if (error) {
          setFlash({
            tone: 'critical',
            text: error.message || 'Could not apply offhrs session in Admin.',
          })
          return
        }
      } catch (e) {
        setFlash({
          tone: 'critical',
          text: e instanceof Error ? e.message : 'Could not apply offhrs session.',
        })
        return
      }

      await loadStatus()
      setFlash({ tone: 'success', text: 'offhrs account connected.' })
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      const data = event.data as ShopifyPopupConnectedMessage
      if (data?.type !== SHOPIFY_POPUP_CONNECTED_MESSAGE) return
      void applyPopupSession(data)
    }

    window.addEventListener('message', onMessage)

    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel(SHOPIFY_CONNECT_BROADCAST)
      bc.onmessage = (event) => {
        const data = event.data as ShopifyPopupConnectedMessage
        if (data?.type !== SHOPIFY_POPUP_CONNECTED_MESSAGE) return
        void applyPopupSession(data)
      }
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener('message', onMessage)
      bc?.close()
    }
  }, [loadStatus])

  useEffect(() => {
    if (connectedQuery === '1') {
      setFlash({ tone: 'success', text: 'offhrs account connected.' })
    } else if (billingQuery === 'active') {
      setFlash({
        tone: status?.billing_active ? 'success' : 'info',
        text: status?.billing_active
          ? 'Shopify Sync plan is active.'
          : 'Confirming Shopify Sync plan…',
      })
    } else if (billingQuery === 'declined') {
      setFlash({
        tone: 'critical',
        text: 'Sync charge was declined. You can request approval again.',
      })
    } else if (billingQuery) {
      setFlash({ tone: 'info', text: `Billing status: ${decodeURIComponent(billingQuery)}` })
    } else if (errorQuery) {
      setFlash({ tone: 'critical', text: decodeURIComponent(errorQuery) })
    }
  }, [connectedQuery, billingQuery, errorQuery, status?.billing_active])

  const accountName = status?.partner_business_name || status?.partner_email || 'offhrs partner'
  /** Shop row exists in offhrs. */
  const shopLinked = Boolean(status?.connected)
  /** Shopify Admin / sticky cookie can manage this shop. */
  const sessionReady = Boolean(status?.session_matches)
  const needsSignIn = shopLinked && !sessionReady
  const billingActive = Boolean(status?.billing_active)
  /** AccountConnection "connected" = shop is linked (not partner cookie). */
  const connected = shopLinked

  const bannerStatus = useMemo(() => {
    if (needsSignIn) {
      return {
        tone: 'warning' as const,
        title: 'Finishing authentication…',
        body: 'Your shop is linked. Tap Retry if Sync is not available yet.',
      }
    }
    if (!shopLinked) {
      return {
        tone: 'warning' as const,
        title: 'Connect your offhrs account',
        body: 'Link an offhrs partner account to publish workshop products into the offhrs app. Guests discover you there and book on Shopify checkout.',
      }
    }
    if (!billingActive) {
      return {
        tone: 'info' as const,
        title: 'Start Shopify Sync',
        body: `Approve ${status?.plan_label ?? SHOPIFY_SYNC_PLAN_LABEL} (${PARTNER_TRIAL_LABEL}) on your Shopify bill to unlock listing sync.`,
      }
    }
    return {
      tone: 'success' as const,
      title: 'Channel ready',
      body: 'Publish workshop products to offhrs from Shopify Admin. Guests book on your Shopify checkout.',
    }
  }, [needsSignIn, shopLinked, billingActive, status?.plan_label])

  function openConnectPopup() {
    const bridge = `/partners/shopify-connect?shop=${encodeURIComponent(shop)}${
      host ? `&host=${encodeURIComponent(host)}` : ''
    }`
    window.open(bridge, 'offhrs-connect', 'width=640,height=720')
  }

  async function connectAccount() {
    openConnectPopup()
  }

  async function disconnectAccount() {
    setActionLoading(true)
    try {
      const res = await channelFetch('/api/shopify/channel/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setFlash({ tone: 'critical', text: data.error ?? 'Disconnect failed.' })
      } else {
        setFlash({ tone: 'success', text: 'Disconnected from offhrs. Products will stop syncing.' })
        await loadStatus()
      }
    } finally {
      setActionLoading(false)
    }
  }

  async function startBilling() {
    setActionLoading(true)
    try {
      // Even if session_matches was false on load, App Bridge may inject auth on this fetch.
      const res = await channelFetch('/api/shopify/channel/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop, host }),
      })
      const data = (await res.json()) as {
        confirmationUrl?: string
        error?: string
        alreadyActive?: boolean
      }
      if (res.status === 401) {
        setFlash({
          tone: 'info',
          text: 'Could not authorize with Shopify yet. Tap Retry, then Start trial again.',
        })
        await loadStatus()
        return
      }
      if (data.alreadyActive) {
        setFlash({ tone: 'success', text: 'Shopify Sync plan is already active.' })
        await loadStatus({ refreshBilling: true, bootstrapSession: false })
        return
      }
      if (!res.ok || !data.confirmationUrl) {
        setFlash({ tone: 'critical', text: data.error ?? 'Could not start billing.' })
        return
      }
      window.top!.location.href = data.confirmationUrl
    } finally {
      setActionLoading(false)
    }
  }

  async function updateAppPermissions() {
    setActionLoading(true)
    try {
      const res = await channelFetch('/api/shopify/channel/reauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop, host }),
      })
      const data = (await res.json()) as { authorizeUrl?: string; error?: string }
      if (!res.ok || !data.authorizeUrl) {
        setFlash({
          tone: 'critical',
          text: data.error ?? 'Could not start permission update.',
        })
        return
      }
      window.top!.location.href = data.authorizeUrl
    } finally {
      setActionLoading(false)
    }
  }

  async function syncPublished() {
    setActionLoading(true)
    try {
      await ensureChannelSession()
      let res = await channelFetch('/api/shopify/channel/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop }),
      })
      if (res.status === 401) {
        await ensureChannelSession()
        res = await channelFetch('/api/shopify/channel/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop }),
        })
      }
      const data = (await res.json()) as {
        error?: string
        warning?: string
        upserted?: number
        skipped?: number
        skipped_no_datetime?: number
        needs_billing?: boolean
        needs_scope_update?: boolean
        published?: { upserted?: number; channel_product_ids?: number; skipped?: number }
      }
      if (!res.ok) {
        if (res.status === 401) {
          setFlash({
            tone: 'critical',
            text: 'Could not authorize Sync with Shopify Admin. Soft-refresh this page, then try again.',
          })
          await loadStatus()
          return
        }
        if (res.status === 402 || data.needs_billing) {
          setFlash({
            tone: 'info',
            text: 'Approve Shopify Sync billing first — click Start trial, then Sync again.',
          })
          await loadStatus()
          return
        }
        setFlash({ tone: 'critical', text: data.error ?? 'Sync failed.' })
        if (data.needs_scope_update) await loadStatus()
        return
      }
      const upserted = data.upserted ?? data.published?.upserted ?? 0
      const skipped = data.skipped_no_datetime ?? data.skipped ?? data.published?.skipped ?? 0
      setLastSyncSummary({
        upserted,
        skipped,
        warning: data.warning,
      })
      if (data.warning) {
        setFlash({ tone: 'info', text: data.warning })
      } else {
        setFlash({
          tone: 'success',
          text:
            upserted > 0
              ? `Synced ${upserted} session(s) from products published to offhrs${
                  skipped > 0 ? ` (${skipped} skipped — usually missing date/time)` : ''
                }.`
              : 'Sync finished but no new sessions were written. Try Sync again, or check product dates.',
        })
      }
      await loadStatus({ bootstrapSession: false })
    } finally {
      setActionLoading(false)
    }
  }

  if (!shop) {
    return (
      <AppProvider i18n={enTranslations}>
        <Page title="offhrs">
          <Banner tone="critical" title="Missing shop">
            <p>Open this app from Shopify Admin → Sales channels → offhrs.</p>
          </Banner>
        </Page>
      </AppProvider>
    )
  }

  return (
    <AppProvider i18n={enTranslations}>
      <Page
        title="offhrs"
        subtitle="Local workshop discovery — guests book on Shopify checkout"
        primaryAction={
          billingActive
            ? {
                content: 'View listings on offhrs',
                url: 'https://offhrs.app',
                external: true,
              }
            : undefined
        }
      >
        <BlockStack gap="400">
          {flash ? (
            <Banner
              tone={flash.tone}
              title={flash.text}
              onDismiss={() => setFlash(null)}
            />
          ) : null}

          {status?.needs_scope_update ? (
            <Banner
              tone="warning"
              title="Update app permissions"
              action={{
                content: 'Approve new scopes',
                onAction: () => {
                  if (!actionLoading) void updateAppPermissions()
                },
              }}
            >
              <p>
                Cart checkout attribution needs the Storefront scope
                (unauthenticated_read_product_listings). Shopify does not always prompt
                automatically — tap Approve new scopes, then Sync again.
              </p>
            </Banner>
          ) : null}

          {needsSignIn ? (
            <Banner
              tone="info"
              title="Authorizing Shopify Admin…"
              action={{
                content: loading || actionLoading ? 'Authorizing…' : 'Retry',
                onAction: () => {
                  if (actionLoading || loading) return
                  setActionLoading(true)
                  void loadStatus({ bootstrapSession: true, showAuthErrors: true }).finally(() =>
                    setActionLoading(false)
                  )
                },
              }}
            >
              <p>
                Your shop is linked and synced. Tap Retry once to finish Admin authorization — then
                Sync and Disconnect will work.
              </p>
            </Banner>
          ) : (
            <Banner tone={bannerStatus.tone} title={bannerStatus.title}>
              <p>{bannerStatus.body}</p>
            </Banner>
          )}

          <Banner tone="info" title="Canada / CAD channel">
            <p>
              offhrs Sync is built for Canada (CAD) with Online Store parity. Channel connection
              needs a Canada market on the shop. Studio address and map pin come from your offhrs
              partner profile.
            </p>
          </Banner>

          <Layout>
            <Layout.AnnotatedSection
              id="account"
              title="Account"
              description="Connect the offhrs partner account for this shop. Disconnect anytime without contacting support."
            >
              <AccountConnection
                title="offhrs"
                accountName={shopLinked ? accountName : undefined}
                connected={connected}
                details={
                  shopLinked
                    ? status?.shop_domain
                      ? `Shop: ${status.shop_domain}`
                      : shop
                    : 'Not connected'
                }
                termsOfService={
                  <Text as="p" variant="bodyMd">
                    By connecting, you agree to the offhrs{' '}
                    <Link url="https://offhrs.app/terms" target="_blank">
                      Terms
                    </Link>{' '}
                    and{' '}
                    <Link url="https://offhrs.app/privacy" target="_blank">
                      Privacy Policy
                    </Link>
                    . Sync is {status?.plan_label ?? SHOPIFY_SYNC_PLAN_LABEL} with a{' '}
                    {PARTNER_TRIAL_LABEL}. offhrs takes 0% commission on synced workshop checkouts.
                    Canada/CAD stores with an Online Store market are supported.
                  </Text>
                }
                action={{
                  content: sessionReady
                    ? 'Disconnect'
                    : needsSignIn
                      ? loading || actionLoading
                        ? 'Authorizing…'
                        : 'Retry'
                      : 'Connect offhrs account',
                  onAction: () => {
                    if (actionLoading || loading) return
                    if (sessionReady) void disconnectAccount()
                    else if (needsSignIn) {
                      setActionLoading(true)
                      void loadStatus({ bootstrapSession: true, showAuthErrors: true }).finally(() =>
                        setActionLoading(false)
                      )
                    } else void connectAccount()
                  },
                }}
              />
            </Layout.AnnotatedSection>

            <Layout.AnnotatedSection
              id="plan"
              title="Shopify Sync plan"
              description="Billed on your Shopify invoice. Approve once to sync published workshops into offhrs."
            >
              <Card>
                <BlockStack gap="300">
                  <Text as="p" variant="bodyMd">
                    {billingActive
                      ? status?.billing_comped
                        ? 'Plan active (comped).'
                        : `Plan active · ${status?.synced_session_count ?? 0} synced session(s).`
                      : `Not subscribed. ${status?.plan_label ?? SHOPIFY_SYNC_PLAN_LABEL} · ${PARTNER_TRIAL_LABEL}.`}
                  </Text>
                  {shopLinked && !billingActive ? (
                    <InlineStack gap="200">
                      <Button variant="primary" loading={actionLoading} onClick={() => void startBilling()}>
                        {status?.billing_status === 'declined'
                          ? 'Request approval again'
                          : 'Start trial'}
                      </Button>
                    </InlineStack>
                  ) : null}
                </BlockStack>
              </Card>
            </Layout.AnnotatedSection>

            {shopLinked && billingActive ? (
              <Layout.AnnotatedSection
                id="publishing"
                title="Publishing"
                description="Publish workshop products to the offhrs sales channel in Shopify Admin. Guests discover them in the offhrs app."
              >
                <Card>
                  <BlockStack gap="300">
                    <Text as="p" variant="bodyMd">
                      {status?.published_session_count ?? status?.synced_session_count ?? 0} session
                      {(status?.published_session_count ?? status?.synced_session_count ?? 0) === 1
                        ? ''
                        : 's'}{' '}
                      live on offhrs
                      {status?.channel_connected ? '' : ' · channel connection pending'}
                      {status?.last_synced_at
                        ? ` · last sync ${new Date(status.last_synced_at).toLocaleString()}`
                        : ''}
                    </Text>
                    <InlineStack gap="200" wrap>
                      {status?.products_admin_url ? (
                        <Button url={status.products_admin_url} target="_blank">
                          Open products
                        </Button>
                      ) : null}
                      {status?.bulk_publications_url ? (
                        <Button url={status.bulk_publications_url} target="_blank">
                          Bulk editor (publications)
                        </Button>
                      ) : null}
                      <Button loading={actionLoading} onClick={() => void syncPublished()}>
                        Sync published products
                      </Button>
                    </InlineStack>
                    {lastSyncSummary ? (
                      <Text as="p" variant="bodySm">
                        Last Sync result: {lastSyncSummary.upserted} session(s) written
                        {lastSyncSummary.skipped > 0
                          ? `; ${lastSyncSummary.skipped} skipped (usually missing session date/time)`
                          : ''}
                        . Publishing problems also appear as product feedback in Shopify Admin.
                        {lastSyncSummary.warning ? ` ${lastSyncSummary.warning}` : ''}
                      </Text>
                    ) : null}
                    <Text as="p" tone="subdued" variant="bodySm">
                      Publish products to the offhrs channel in Admin. Add a parseable session date
                      (metafield offhrs.starts_at or a Date option) so listings appear. After guests
                      Book on Shopify, confirm the order attributes to offhrs in Admin analytics.
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.AnnotatedSection>
            ) : null}

            <Layout.AnnotatedSection
              id="marketplace"
              title="Where listings appear"
              description="After products sync, customers discover them in the offhrs app."
            >
              <Card>
                <BlockStack gap="200">
                  <Button url="https://offhrs.app" target="_blank">
                    Open offhrs
                  </Button>
                  <Text as="p" tone="subdued" variant="bodySm">
                    Studio address and map pin still come from your offhrs partner profile — not from
                    product fields.
                  </Text>
                </BlockStack>
              </Card>
            </Layout.AnnotatedSection>
          </Layout>
        </BlockStack>
      </Page>
    </AppProvider>
  )
}
