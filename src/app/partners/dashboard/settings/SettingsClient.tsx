'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatGstHstRegistrationNumberForDisplay } from '@/lib/vendor-gst-hst'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import { ExternalLink, Loader2, AlertTriangle, CalendarX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type ShopifyStatus =
  | { connected: false }
  | {
      connected: true
      shop_domain: string
      scope: string | null
      sync_enabled: boolean
      last_synced_at: string | null
      installed_at: string | null
      synced_session_count: number
    }

interface Vendor {
  id: string
  business_name: string
  bio: string | null
  website_url: string | null
  instagram_handle: string | null
  phone: string | null
  location_address: string | null
  location_unit: string | null
  refund_window_hours: number
  strict_no_refund: boolean
  status: string
  subscription_current_period_end: string | null
  gst_hst_registered: boolean
  gst_hst_registration_number: string | null
}

interface SubscriptionState {
  /** True if Stripe has the subscription set to cancel at the end of the period. */
  cancelAtPeriodEnd: boolean
  /** Raw Stripe subscription status (e.g. 'active', 'trialing', 'canceled'). */
  status: string | null
  /** ISO timestamp the vendor retains access until. Prefer this over
   *  vendor_profiles.subscription_current_period_end so the date matches the
   *  most recent webhook update. */
  currentPeriodEnd: string | null
}

interface SettingsClientProps {
  vendor: Vendor
  email: string
  subscription: SubscriptionState
}

function formatLongDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function SettingsClient({ vendor, email, subscription }: SettingsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Profile form
  const [profile, setProfile] = useState({
    business_name: vendor.business_name,
    bio: vendor.bio ?? '',
    website_url: vendor.website_url ?? '',
    phone: vendor.phone ?? '',
    location_address: vendor.location_address ?? '',
    location_unit: vendor.location_unit ?? '',
    refund_window_hours: vendor.refund_window_hours.toString(),
  })
  const [instagramHandle, setInstagramHandle] = useState(vendor.instagram_handle ?? '')
  const [instagramLoading, setInstagramLoading] = useState(false)
  const [instagramMsg, setInstagramMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [strictNoRefund, setStrictNoRefund] = useState(vendor.strict_no_refund === true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [taxRegistered, setTaxRegistered] = useState(vendor.gst_hst_registered)
  const [taxNumber, setTaxNumber] = useState(
    formatGstHstRegistrationNumberForDisplay(vendor.gst_hst_registration_number)
  )
  const [taxLoading, setTaxLoading] = useState(false)
  const [taxMsg, setTaxMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(
    null
  )

  // Password form
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Billing portal
  const [portalLoading, setPortalLoading] = useState(false)

  // Promo code (apply to existing subscription without changing plan)
  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoMsg, setPromoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Shopify workshop feed
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyStatus | null>(null)
  const [shopifyShopInput, setShopifyShopInput] = useState('')
  const [shopifySyncLoading, setShopifySyncLoading] = useState(false)
  const [shopifyDisconnectLoading, setShopifyDisconnectLoading] = useState(false)
  const [shopifyMsg, setShopifyMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Account deletion
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadShopifyStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/partners/shopify/status')
      if (!res.ok) {
        setShopifyStatus(null)
        return
      }
      setShopifyStatus((await res.json()) as ShopifyStatus)
    } catch {
      setShopifyStatus(null)
    }
  }, [])

  useEffect(() => {
    void loadShopifyStatus()
  }, [loadShopifyStatus])

  useEffect(() => {
    const connected = searchParams.get('shopify_connected')
    const err = searchParams.get('shopify_error')
    if (!connected && !err) return
    if (err) {
      setShopifyMsg({ type: 'error', text: `Shopify: ${decodeURIComponent(err)}` })
    } else {
      setShopifyMsg({
        type: 'success',
        text: 'Shopify connected. Tagged workshop products will sync into the offhrs app.',
      })
    }
    void loadShopifyStatus()
    router.replace('/partners/dashboard/settings', { scroll: false })
  }, [searchParams, router, loadShopifyStatus])

  function connectShopify() {
    const shop = shopifyShopInput.trim()
    if (!shop) {
      setShopifyMsg({ type: 'error', text: 'Enter your store domain (e.g. your-store.myshopify.com).' })
      return
    }
    window.location.href = `/api/partners/shopify/install?shop=${encodeURIComponent(shop)}`
  }

  async function syncShopify() {
    setShopifySyncLoading(true)
    setShopifyMsg(null)
    try {
      const res = await fetch('/api/partners/shopify/sync', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setShopifyMsg({ type: 'error', text: data.error ?? 'Sync failed.' })
        return
      }
      setShopifyMsg({
        type: 'success',
        text: `Synced ${data.upserted ?? 0} session(s) from ${data.products ?? 0} product(s)${
          data.skipped ? ` (${data.skipped} skipped)` : ''
        }.`,
      })
      await loadShopifyStatus()
    } catch {
      setShopifyMsg({ type: 'error', text: 'Sync failed.' })
    } finally {
      setShopifySyncLoading(false)
    }
  }

  async function disconnectShopify() {
    if (
      !confirm(
        'Disconnect Shopify? Synced workshop listings will be archived in the offhrs app. You can reconnect later.'
      )
    ) {
      return
    }
    setShopifyDisconnectLoading(true)
    setShopifyMsg(null)
    try {
      const res = await fetch('/api/partners/shopify/disconnect', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setShopifyMsg({ type: 'error', text: data.error ?? 'Disconnect failed.' })
        return
      }
      setShopifyMsg({ type: 'success', text: 'Shopify disconnected.' })
      setShopifyShopInput('')
      await loadShopifyStatus()
    } catch {
      setShopifyMsg({ type: 'error', text: 'Disconnect failed.' })
    } finally {
      setShopifyDisconnectLoading(false)
    }
  }

  function setP(key: keyof typeof profile, val: string) {
    setProfile((f) => ({ ...f, [key]: val }))
  }

  async function saveInstagramHandle(e: React.FormEvent) {
    e.preventDefault()
    setInstagramLoading(true)
    setInstagramMsg(null)
    try {
      const res = await fetch(`/api/partners/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          instagram_handle: instagramHandle,
          strict_no_refund: strictNoRefund,
          refund_window_hours: strictNoRefund ? undefined : parseInt(profile.refund_window_hours) || 48,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInstagramMsg({
          type: 'error',
          text: data.fields?.instagram_handle?.[0] ?? data.error ?? 'Failed to save Instagram handle.',
        })
      } else {
        setInstagramMsg({ type: 'success', text: 'Instagram handle saved.' })
      }
    } catch {
      setInstagramMsg({ type: 'error', text: 'Network error.' })
    } finally {
      setInstagramLoading(false)
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileLoading(true)
    setProfileMsg(null)
    try {
      const res = await fetch(`/api/partners/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          instagram_handle: instagramHandle,
          strict_no_refund: strictNoRefund,
          refund_window_hours: strictNoRefund ? undefined : parseInt(profile.refund_window_hours) || 48,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setProfileMsg({ type: 'error', text: data.error ?? 'Failed to save.' })
      } else {
        setProfileMsg({ type: 'success', text: 'Profile saved successfully.' })
      }
    } catch {
      setProfileMsg({ type: 'error', text: 'Network error.' })
    } finally {
      setProfileLoading(false)
    }
  }

  async function saveTaxSettings(e: React.FormEvent) {
    e.preventDefault()
    setTaxLoading(true)
    setTaxMsg(null)
    try {
      const res = await fetch('/api/partners/tax-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gst_hst_registered: taxRegistered,
          gst_hst_registration_number: taxRegistered ? taxNumber : '',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTaxMsg({ type: 'error', text: data.error ?? 'Failed to save tax settings.' })
        return
      }
      if (data.gst_hst_registration_number) {
        setTaxNumber(data.gst_hst_registration_number)
      }
      setTaxMsg({
        type: data.warning ? 'warning' : 'success',
        text:
          data.warning ??
          (taxRegistered
            ? 'GST/HST registration saved. Tax will be calculated at checkout.'
            : 'Saved. Workshop prices will not include GST/HST until you register with the CRA.'),
      })
    } catch {
      setTaxMsg({ type: 'error', text: 'Network error.' })
    } finally {
      setTaxLoading(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (passwords.next !== passwords.confirm) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    if (passwords.next.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    setPasswordLoading(true)
    setPasswordMsg(null)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { error } = await supabase.auth.updateUser({ password: passwords.next })
      if (error) {
        setPasswordMsg({ type: 'error', text: error.message })
      } else {
        setPasswordMsg({ type: 'success', text: 'Password updated successfully.' })
        setPasswords({ current: '', next: '', confirm: '' })
      }
    } finally {
      setPasswordLoading(false)
    }
  }

  async function openBillingPortal() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/partners/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert(data.error ?? 'Could not open billing portal.')
    } finally {
      setPortalLoading(false)
    }
  }

  async function applyPromoCode(e: React.FormEvent) {
    e.preventDefault()
    const code = promoCode.trim()
    if (!code) {
      setPromoMsg({ type: 'error', text: 'Enter a promotion code.' })
      return
    }
    setPromoLoading(true)
    setPromoMsg(null)
    try {
      const res = await fetch('/api/partners/apply-promo-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) {
        setPromoMsg({ type: 'error', text: data.error ?? 'Could not apply this code.' })
        return
      }
      setPromoMsg({
        type: 'success',
        text: data.message ?? 'Promotion code applied. Your plan is unchanged.',
      })
      setPromoCode('')
    } catch {
      setPromoMsg({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setPromoLoading(false)
    }
  }

  async function deleteAccount() {
    const confirmed = confirm(
      'Delete your vendor account?\n\n' +
        'This is permanent and cannot be undone. We will:\n' +
        '  • Cancel your offhrs Partners subscription immediately\n' +
        '  • Refund any active paid customer bookings\n' +
        '  • Delete your business profile, workshops, bookings, payout records, and calendar connections\n\n' +
        'Before you continue:\n' +
        '  • Check Stripe Express (Payouts) for any balance or pending payouts — bank payouts continue on Stripe’s schedule even after you leave offhrs\n' +
        '  • Confirm you are okay refunding any upcoming paid bookings\n' +
        '  • Export your Bookings CSV if you need records — offhrs data is removed and cannot be recovered\n\n' +
        'If you also use the offhrs mobile app as a consumer with the same email, ' +
        'that consumer account is kept and you will still be able to log in there.'
    )
    if (!confirmed) return
    setDeleteLoading(true)
    setDeleteMsg(null)
    try {
      const res = await fetch('/api/partners/account/delete', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to delete vendor account.')
      }

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      // Only sign the browser out if the auth user is actually gone. When the
      // same login still has a consumer profile we keep auth.users intact and
      // the session is still valid, but the vendor dashboard data is gone.
      if (!data.preservedConsumerAccount) {
        await supabase.auth.signOut()
      }
      router.push('/partners/login')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete vendor account.'
      setDeleteMsg({ type: 'error', text: message })
    } finally {
      setDeleteLoading(false)
    }
  }

  const periodEnd = formatLongDate(
    subscription.currentPeriodEnd ?? vendor.subscription_current_period_end
  )

  // Derived subscription UI states:
  //   - `subscriptionEnded` covers the case where Stripe has fully ended the
  //     subscription (customer.subscription.deleted webhook flipped vendor
  //     status to 'canceled').
  //   - `cancellationScheduled` covers the in-between state: vendor clicked
  //     "Cancel" in Stripe billing portal so `cancel_at_period_end=true`, but
  //     they still have paid access until `currentPeriodEnd`.
  //   - `subscriptionActive` is the default healthy / trialing state.
  const subscriptionEnded =
    vendor.status === 'canceled' ||
    vendor.status === 'cancelled' ||
    subscription.status === 'canceled'
  const cancellationScheduled = !subscriptionEnded && subscription.cancelAtPeriodEnd
  const subscriptionActive = !subscriptionEnded && !cancellationScheduled

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your business profile and account preferences.</p>
      </div>

      {/* Business profile */}
      <Card className="gap-0 border-partner-border py-0 shadow-none">
        <CardContent className="space-y-4 p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Business profile</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Business name</label>
              <Input
                value={profile.business_name}
                onChange={(e) => setP('business_name', e.target.value)}
                className="h-10 border-partner-border bg-white shadow-none"
               />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Bio</label>
              <Textarea
                value={profile.bio}
                onChange={(e) => setP('bio', e.target.value)}
                rows={3}
                placeholder="Tell consumers about your studio and teaching style..."
                className="min-h-[5rem] border-partner-border bg-white shadow-none resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Website URL</label>
              <Input
                type="url"
                value={profile.website_url}
                onChange={(e) => setP('website_url', e.target.value)}
                placeholder="https://yourstudio.com"
                className="h-10 border-partner-border bg-white shadow-none"
               />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone</label>
              <Input
                type="tel"
                value={profile.phone}
                onChange={(e) => setP('phone', e.target.value)}
                placeholder="+1 (416) 555-0100"
                className="h-10 border-partner-border bg-white shadow-none"
               />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Studio address</label>
              <Input
                value={profile.location_address}
                onChange={(e) => setP('location_address', e.target.value)}
                placeholder="123 Main St, Toronto, ON M5V 1A1"
                className="h-10 border-partner-border bg-white shadow-none"
               />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Unit number <span className="font-normal">(optional)</span>
              </label>
              <Input
                value={profile.location_unit}
                onChange={(e) => setP('location_unit', e.target.value)}
                placeholder="e.g. 204"
                className="h-10 border-partner-border bg-white shadow-none"
               />
            </div>
            <div className="col-span-2">
              <p className="block text-xs font-medium text-muted-foreground mb-2">Cancellation policy</p>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                Applies to all of your workshops. Customers see this before they book.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStrictNoRefund(false)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    !strictNoRefund
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-partner-border bg-white hover:border-muted-foreground/40'
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">Flexible refunds</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Customers can cancel for a full refund before your cutoff time.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setStrictNoRefund(true)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    strictNoRefund
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-partner-border bg-white hover:border-muted-foreground/40'
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">Strict — no refunds</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Paid bookings are non-refundable once purchased.
                  </p>
                </button>
              </div>
            </div>
            {!strictNoRefund ? (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Refund window (hours before workshop)
                </label>
                <Input
                  type="number"
                  min={24}
                  value={profile.refund_window_hours}
                  onChange={(e) => setP('refund_window_hours', e.target.value)}
                  className="h-10 border-partner-border bg-white shadow-none"
                 />
                <p className="text-xs text-muted-foreground mt-1">Minimum 24 hours (platform policy).</p>
              </div>
            ) : (
              <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold text-amber-900">Strict policy active</p>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Customers will see: &ldquo;Strict Policy: This booking is non-refundable once
                  purchased.&rdquo; They cannot cancel paid bookings for a refund in the app.
                </p>
              </div>
            )}
          </div>

          {profileMsg && (
            <p className={`text-sm px-4 py-3 rounded-xl ${
              profileMsg.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}>
              {profileMsg.text}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={profileLoading}>
              {profileLoading && <Loader2 className="size-4 animate-spin" />}
              Save profile
            </Button>
          </div>
        </form>
      </CardContent>
      </Card>

      {/* Workshop sales tax (GST/HST) */}
      <Card className="gap-0 border-partner-border py-0 shadow-none">
        <CardContent className="space-y-4 p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Workshop sales tax (GST/HST)</h2>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          You are the seller of record for workshop tickets. offhrs only adds GST/HST at checkout when
          you confirm you are registered with the CRA. If you are a small supplier (generally under
          $30,000 in taxable sales over four quarters), leave this off and do not charge tax on
          tickets.
        </p>
        <form onSubmit={saveTaxSettings} className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <Input
              type="checkbox"
              checked={taxRegistered}
              onChange={(e) => {
                setTaxRegistered(e.target.checked)
                setTaxMsg(null)
              }}
              className="mt-1 h-4 w-4 rounded border-partner-border text-primary focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground leading-relaxed">
              I am registered for GST/HST with the CRA and authorized to charge tax on my workshop
              sales.
            </span>
          </label>
          {taxRegistered && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                GST/HST registration number
              </label>
              <input
                value={taxNumber}
                onChange={(e) => {
                  setTaxNumber(e.target.value)
                  setTaxMsg(null)
                }}
                placeholder="123456789 RT 0001"
                className="h-10 border-partner-border bg-white shadow-none"
               />
            </div>
          )}
          {taxMsg && (
            <p
              className={`text-sm px-4 py-3 rounded-xl ${
                taxMsg.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : taxMsg.type === 'warning'
                    ? 'bg-amber-50 border border-amber-200 text-amber-800'
                    : 'bg-red-50 border border-red-200 text-red-600'
              }`}
            >
              {taxMsg.text}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={taxLoading}>
              {taxLoading && <Loader2 className="size-4 animate-spin" />}
              Save tax settings
            </Button>
          </div>
        </form>
      </CardContent>
      </Card>

      {/* Subscription */}
      <Card className="gap-0 border-partner-border py-0 shadow-none">
        <CardContent className="space-y-4 p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Subscription</h2>
        <p className="text-xs text-muted-foreground mb-4">Manage your billing, invoices, and payment method.</p>
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {subscriptionEnded ? (
              <span className="font-medium text-red-700">Subscription ended</span>
            ) : cancellationScheduled ? (
              <>
                <span className="font-medium text-amber-700">Cancellation scheduled</span>
                {periodEnd && (
                  <span className="text-muted-foreground"> · access until {periodEnd}</span>
                )}
              </>
            ) : (
              <>
                <span className="capitalize font-medium text-foreground">{vendor.status}</span>
                {periodEnd && (
                  <span className="text-muted-foreground"> · renews {periodEnd}</span>
                )}
              </>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={openBillingPortal}
            disabled={portalLoading}
            className="border-primary text-primary hover:bg-partner-tint"
          >
            {portalLoading ? <Loader2 className="size-4 animate-spin" /> : null}
            {portalLoading ? 'Opening…' : 'Manage billing'}
          </Button>
        </div>

        {!subscriptionEnded ? (
          <form onSubmit={applyPromoCode} className="space-y-3 border-t border-partner-border pt-4">
            <p className="text-xs font-semibold text-foreground">Have a promo code?</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Apply a Stripe promotion code to your current plan (no plan change required). For a
              “second month free” offer, apply it during your trial so the first paid invoice is $0.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Enter promotion code"
                autoComplete="off"
                className="h-10 border-partner-border bg-white shadow-none sm:max-w-xs"
              />
              <Button
                type="submit"
                variant="outline"
                disabled={promoLoading || !promoCode.trim()}
                className="border-partner-border"
              >
                {promoLoading && <Loader2 className="size-4 animate-spin" />}
                {promoLoading ? 'Applying…' : 'Apply code'}
              </Button>
            </div>
            {promoMsg ? (
              <p
                className={`text-sm px-4 py-3 rounded-xl ${
                  promoMsg.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-600'
                }`}
              >
                {promoMsg.text}
              </p>
            ) : null}
          </form>
        ) : null}
      </CardContent>
      </Card>

      {/* Shopify workshop feed */}
      <Card className="gap-0 border-partner-border py-0 shadow-none">
        <CardContent className="space-y-4 p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Shopify</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Sync workshop products into the offhrs app. Guests book on your Shopify storefront (not
            in-app Stripe). Tag products with <span className="font-medium text-foreground">offhrs_workshop</span>
            ; for time-slot variants (e.g. a Date option like “August 21, 2026 12:00 PM”), each
            variant becomes its own session.
          </p>

          {shopifyStatus?.connected ? (
            <div className="space-y-3">
              <div className="text-sm text-foreground">
                Connected:{' '}
                <span className="font-medium text-primary">{shopifyStatus.shop_domain}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {shopifyStatus.synced_session_count} active synced session
                {shopifyStatus.synced_session_count === 1 ? '' : 's'}
                {shopifyStatus.last_synced_at
                  ? ` · last sync ${formatLongDate(shopifyStatus.last_synced_at) ?? shopifyStatus.last_synced_at}`
                  : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void syncShopify()}
                  disabled={shopifySyncLoading || shopifyDisconnectLoading}
                  className="border-partner-border"
                >
                  {shopifySyncLoading && <Loader2 className="size-4 animate-spin" />}
                  {shopifySyncLoading ? 'Syncing…' : 'Sync now'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void disconnectShopify()}
                  disabled={shopifySyncLoading || shopifyDisconnectLoading}
                  className="border-red-200 text-red-700 hover:bg-red-50"
                >
                  {shopifyDisconnectLoading && <Loader2 className="size-4 animate-spin" />}
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Store domain
                </label>
                <Input
                  type="text"
                  value={shopifyShopInput}
                  onChange={(e) => setShopifyShopInput(e.target.value)}
                  placeholder="your-store.myshopify.com"
                  autoComplete="off"
                  className="h-10 border-partner-border bg-white shadow-none sm:max-w-md"
                />
              </div>
              <Button
                type="button"
                onClick={connectShopify}
                className="border-primary"
              >
                Connect Shopify
                <ExternalLink className="size-3.5 opacity-70" />
              </Button>
            </div>
          )}

          {shopifyMsg ? (
            <p
              className={`rounded-xl px-4 py-3 text-sm ${
                shopifyMsg.type === 'success'
                  ? 'border border-green-200 bg-green-50 text-green-700'
                  : 'border border-red-200 bg-red-50 text-red-600'
              }`}
            >
              {shopifyMsg.text}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Account */}
      <Card className="gap-0 border-partner-border py-0 shadow-none">
        <CardContent className="space-y-4 p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Account</h2>
        <div className="mb-4 text-sm text-muted-foreground">
          <span className="text-xs font-medium text-muted-foreground">Email</span>
          <p className="mt-0.5">{email}</p>
        </div>
        <form onSubmit={saveInstagramHandle} className="mb-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Instagram handle</label>
            <Input
              type="text"
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
              placeholder="@yourstudio"
              className="h-10 border-partner-border bg-white shadow-none"
             />
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Optional. Shown on your vendor profile in the offhrs app. Leave blank to hide the Instagram link.
            </p>
          </div>
          {instagramMsg && (
            <p
              className={`text-sm px-4 py-3 rounded-xl ${
                instagramMsg.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-600'
              }`}
            >
              {instagramMsg.text}
            </p>
          )}
          <Button type="submit" variant="outline" disabled={instagramLoading} className="border-partner-border">
            {instagramLoading && <Loader2 className="size-4 animate-spin" />}
            Save Instagram
          </Button>
        </form>
        <form onSubmit={changePassword} className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">Change password</p>
          <Input
            type="password"
            placeholder="New password"
            value={passwords.next}
            onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
            className="h-10 border-partner-border bg-white shadow-none"
           />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={passwords.confirm}
            onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
            className="h-10 border-partner-border bg-white shadow-none"
           />
          {passwordMsg && (
            <p className={`text-sm px-4 py-3 rounded-xl ${
              passwordMsg.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}>
              {passwordMsg.text}
            </p>
          )}
          <Button type="submit" variant="outline" disabled={passwordLoading} className="border-partner-border">
            {passwordLoading && <Loader2 className="size-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="gap-0 border-red-200 py-0 shadow-none">
        <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
        </div>

        {cancellationScheduled && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <CalendarX className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 leading-relaxed">
              <p className="font-semibold mb-0.5">Subscription cancellation scheduled</p>
              <p>
                Your offhrs Partners subscription is set to cancel
                {periodEnd ? <> at the end of your current billing period on <strong>{periodEnd}</strong>.</> : '.'}{' '}
                You&apos;ll keep full access until then. To resume billing, open <strong>Manage billing</strong> above
                and choose <em>Renew plan</em>.
              </p>
            </div>
          </div>
        )}

        {subscriptionEnded && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <CalendarX className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 leading-relaxed">
              <p className="font-semibold mb-0.5">Subscription ended</p>
              <p>
                Your offhrs Partners subscription has ended. Your data is retained for 30 days; reactivate any
                time from the partners signup page to restore your dashboard.
              </p>
            </div>
          </div>
        )}

        {subscriptionActive ? (
          <>
            <p className="text-xs text-muted-foreground mb-4">
              Canceling your subscription retains access until the end of your current billing period.
              Your data is kept for 30 days after cancellation.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={openBillingPortal}
              disabled={portalLoading}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              Cancel subscription
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={openBillingPortal}
            disabled={portalLoading}
            className="border-primary text-primary hover:bg-partner-tint"
          >
            {portalLoading ? 'Opening…' : 'Manage subscription'}
          </Button>
        )}

        <div className="mt-4 border-t border-red-100 pt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Deleting your vendor account cancels your subscription right away, refunds active paid
            bookings, and permanently removes your business profile, workshops, bookings, payout
            records, and calendar connections. Funds already in your Stripe Express account still
            pay out to your bank on Stripe’s schedule — but you will lose payout history in this
            dashboard. Before deleting, check Stripe Express for any pending balance, confirm you are
            okay refunding upcoming paid bookings, and export your Bookings CSV if you need records.
            If you also use the offhrs mobile app with the same email, your consumer account is kept.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={deleteAccount}
            disabled={deleteLoading}
            className="w-full border-red-200 text-red-700 hover:bg-red-50"
          >
            {deleteLoading ? 'Deleting…' : 'Delete vendor account'}
          </Button>
          {deleteMsg && (
            <p
              className={`mt-3 text-sm px-4 py-3 rounded-xl ${
                deleteMsg.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-600'
              }`}
            >
              {deleteMsg.text}
            </p>
          )}
        </div>
      </CardContent>
      </Card>
    </div>
  )
}
