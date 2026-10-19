'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Banner, Button, Card, Form, FormLayout, Link, Text, TextField } from '@shopify/polaris'
import { createClient } from '@/lib/supabase/browser'
import {
  buildShopifyChannelSignupHref,
  rememberShopifyChannelSignup,
  safeShopifyConnectNext,
  safeShopifyShop,
} from '@/lib/shopify/channel-signup'
import { ShopifyChannelPolarisFrame } from '@/components/shopify/ShopifyChannelPolarisFrame'

export function ShopifyChannelLogin() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const signupHref = buildShopifyChannelSignupHref(searchParams)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    rememberShopifyChannelSignup({
      next: safeShopifyConnectNext(searchParams.get('next')),
      shop: safeShopifyShop(searchParams.get('shopify_shop')),
    })
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    async function resumeIfSignedIn() {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      if (session) {
        const next = safeShopifyConnectNext(searchParams.get('next'))
        if (next) {
          window.location.replace(next)
          return
        }
        const shop = safeShopifyShop(searchParams.get('shopify_shop'))
        if (shop) {
          window.location.replace(`/partners/shopify-connect?shop=${encodeURIComponent(shop)}`)
          return
        }
        router.replace('/partners/dashboard')
        return
      }
      setCheckingSession(false)
    }
    void resumeIfSignedIn()
    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        void fetch('/api/partners/auth/login-failed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }).catch(() => {})
        throw signInError
      }
      const next = safeShopifyConnectNext(searchParams.get('next'))
      if (next) {
        window.location.replace(next)
        return
      }
      const shop = safeShopifyShop(searchParams.get('shopify_shop'))
      if (shop) {
        window.location.replace(`/partners/shopify-connect?shop=${encodeURIComponent(shop)}`)
        return
      }
      router.replace('/partners/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password')
      setLoading(false)
    }
  }

  return (
    <ShopifyChannelPolarisFrame>
      <Text as="h1" variant="headingLg">
        Sign in to offhrs
      </Text>
      <Text as="p" variant="bodyMd" tone="subdued">
        Use the offhrs partner account for this Shopify shop. Shopify Sync is billed in Shopify.
      </Text>
      <Card>
        {checkingSession ? (
          <Text as="p" variant="bodyMd">
            Checking sign-in…
          </Text>
        ) : (
          <Form onSubmit={handleSubmit}>
            <FormLayout>
              {error ? (
                <Banner tone="critical" title="Could not sign in">
                  <p>{error}</p>
                </Banner>
              ) : null}
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                requiredIndicator
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                requiredIndicator
                labelAction={{ content: 'Forgot password?', url: '/partners/reset-password' }}
              />
              <Button variant="primary" submit loading={loading} fullWidth>
                Sign in
              </Button>
            </FormLayout>
          </Form>
        )}
      </Card>
      <Text as="p" variant="bodyMd">
        Don&apos;t have an account?{' '}
        <Link url={signupHref ?? '/partners/signup?intent=shopify_sync&from=shopify_channel'}>
          Create a Shopify Sync account
        </Link>
      </Text>
    </ShopifyChannelPolarisFrame>
  )
}
