import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { ConnectStripeButton } from './components/ConnectStripeButton'
import { PartnerDashboardHeaderActions } from './components/PartnerDashboardHeaderActions'
import { EnableMarketplaceButton } from './components/EnableMarketplaceButton'
import {
  DashboardHomeViews,
  type DashboardBookingRow,
} from './components/DashboardHomeViews'
import { repairOrphanedStripeRefundsForVendor } from '@/lib/booking-refund'
import { reconcileVendorEventSlots } from '@/lib/event-slot-reconcile'
import { reconcileStripeConnectStatus } from '@/lib/stripe-connect-reconcile'
import { buildActivitySeriesFromBookings, type BookingActivityRow } from '@/lib/partner-dashboard-activity'
import { vendorHasNativePartnerPlan } from '@/lib/partner-access'
import { shopifyBillingAllowsSync } from '@/lib/shopify/billing'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface VendorProfile {
  id: string
  business_name: string
  bio: string | null
  status: string
  email_verified: boolean
  stripe_checkout_completed: boolean
  stripe_connect_completed: boolean
  stripe_account_id: string | null
  location_address: string | null
  first_session_created: boolean
  trial_ends_at: string | null
  subscription_current_period_end: string | null
  gst_hst_settings_confirmed_at: string | null
}

function daysUntil(date: string | null): number | null {
  if (!date) return null
  const diff = new Date(date).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>
}) {
  const { onboarding } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/partners/login')

  const admin = createAdminClient()
  if (!admin) return <div className="p-8 text-red-500">Server configuration error</div>

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single() as { data: VendorProfile | null }

  if (!vendor) redirect('/partners/signup')

  const hasNativePlan = await vendorHasNativePartnerPlan(admin, vendor.id)

  // Refresh marketplace_enabled in case columns exist after migration.
  const marketplaceEnabled = Boolean(
    (vendor as VendorProfile & { marketplace_enabled?: boolean }).marketplace_enabled
  )

  if (!hasNativePlan && marketplaceEnabled) {
    const v = vendor as VendorProfile & {
      ship_from_line1?: string | null
      canada_ship_attested_at?: string | null
    }
    const shippingReady = Boolean(v.ship_from_line1?.trim() && v.canada_ship_attested_at)
    const profileReady = Boolean(vendor.bio?.trim() && vendor.location_address?.trim())
    const connectReady = Boolean(vendor.stripe_connect_completed)
    const checklistItems = [
      {
        key: 'email_verified',
        label: 'Verify your email',
        done: vendor.email_verified,
        showStripeCta: false,
        href: null as string | null,
      },
      {
        key: 'shipping_settings',
        label: 'Add ship-from address & Canada attestation',
        done: shippingReady,
        showStripeCta: false,
        href: shippingReady ? null : '/partners/dashboard/marketplace',
      },
      {
        key: 'connect',
        label: 'Connect Stripe for payouts',
        done: connectReady,
        showStripeCta: !connectReady,
        href: '/partners/dashboard/settings',
      },
      {
        key: 'profile',
        label: 'Add bio & studio address (Settings)',
        done: profileReady,
        showStripeCta: false,
        href: profileReady ? null : '/partners/dashboard/settings',
      },
    ]

    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome back, {vendor.business_name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;re on Artist Marketplace (free) — manage products and shipping in Marketplace.
              Connect Stripe in Settings for payouts.
            </p>
          </div>
          <PartnerDashboardHeaderActions
            items={checklistItems}
            allDone={checklistItems.every((c) => c.done)}
            trialDays={null}
            openGettingStartedInitially={onboarding === '1'}
          />
        </div>

        <Card className="gap-0 border-partner-border py-0 shadow-none">
          <CardContent className="space-y-3 p-5">
            <h2 className="text-sm font-semibold text-foreground">Artist Marketplace</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              List physical goods for Canada-only shipping. Platform fee is 5% of item subtotal plus Stripe
              processing. Workshops stay on Lite/Pro if you want bookings too.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm">
                <Link href="/partners/dashboard/marketplace">Open Marketplace</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="border-partner-border">
                <Link href="/partners/dashboard/settings">Settings &amp; Connect</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!hasNativePlan) {
    const { data: shop } = await admin
      .from('vendor_shopify_shops')
      .select('shop_domain, billing_status, last_synced_at')
      .eq('vendor_id', vendor.id)
      .maybeSingle()

    const { count: syncedCount } = await admin
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendor.id)
      .eq('listing_source', 'shopify')
      .neq('booking_status', 'archived')

    const shopConnected = Boolean(shop)
    const billingActive = shop
      ? shopifyBillingAllowsSync({
          billingStatus: shop.billing_status,
          shopDomain: shop.shop_domain,
        })
      : false
    const profileReady = Boolean(vendor.bio?.trim() && vendor.location_address?.trim())
    const hasSyncedSessions = (syncedCount ?? 0) > 0

    const checklistItems = [
      {
        key: 'email_verified',
        label: 'Verify your email',
        done: vendor.email_verified,
        showStripeCta: false,
        href: null as string | null,
      },
      {
        key: 'shopify_connected',
        label: 'Connect Shopify & start Sync trial',
        done: shopConnected && billingActive,
        showStripeCta: false,
        href: '/partners/dashboard/settings',
      },
      {
        key: 'profile_settings_reviewed',
        label: 'Add bio & studio address (Settings)',
        done: profileReady,
        showStripeCta: false,
        href: profileReady ? null : '/partners/dashboard/settings',
      },
      {
        key: 'first_shopify_sync',
        label: 'Tag products & Sync now',
        done: hasSyncedSessions,
        showStripeCta: false,
        href: '/partners/dashboard/settings',
      },
    ]

    const allDone = checklistItems.every((c) => c.done)

    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome back, {vendor.business_name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;re on Shopify Sync — manage your connection and product feed in Settings.
            </p>
          </div>
          <PartnerDashboardHeaderActions
            items={checklistItems}
            allDone={allDone}
            trialDays={null}
            openGettingStartedInitially={onboarding === '1' && !allDone}
          />
        </div>

        <Card className="gap-0 border-partner-border py-0 shadow-none">
          <CardContent className="space-y-3 p-5">
            <h2 className="text-sm font-semibold text-foreground">Shopify Sync</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {shop ? (
                <>
                  Connected to{' '}
                  <span className="font-medium text-foreground">{shop.shop_domain}</span>
                  {billingActive
                    ? ` · ${syncedCount ?? 0} synced session${(syncedCount ?? 0) === 1 ? '' : 's'}`
                    : ' · subscribe to Sync in Settings to unlock product sync'}
                  {shop.last_synced_at
                    ? ` · last sync ${new Date(shop.last_synced_at).toLocaleDateString('en-CA')}`
                    : ''}
                </>
              ) : (
                <>
                  Install the offhrs app from Shopify Admin, then return here to start your Sync trial.
                  Guests book on your Shopify storefront — no Stripe payout setup required.
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm">
                <Link href="/partners/dashboard/settings">Open Settings</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="border-partner-border">
                <Link href="/partners/shopify-sync">Setup guide</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 border-partner-border py-0 shadow-none">
          <CardContent className="space-y-2 p-5">
            <h2 className="text-sm font-semibold text-foreground">Sell goods on Artist Marketplace</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Free to join — 5% + Stripe on sales. Canada-only shipping via platform Shippo. Does not
              replace Shopify Sync.
            </p>
            <EnableMarketplaceButton />
          </CardContent>
        </Card>

        <Card className="gap-0 border-partner-border py-0 shadow-none">
          <CardContent className="space-y-2 p-5">
            <h2 className="text-sm font-semibold text-foreground">Want bookings on offhrs too?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Lite and Pro unlock in-app checkout, Stripe payouts, workshops, calendar, bookings, and
              clients. Sync stays separate and can run alongside either plan.
            </p>
            <Button asChild size="sm" variant="outline" className="border-partner-border mt-1">
              <Link href="/partners/checkout">View Lite &amp; Pro</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  await repairOrphanedStripeRefundsForVendor(admin, vendor.id)
  await reconcileVendorEventSlots(admin, vendor.id)

  const connectReconciled = await reconcileStripeConnectStatus(admin, {
    id: vendor.id,
    stripe_account_id: vendor.stripe_account_id,
    stripe_connect_completed: vendor.stripe_connect_completed,
    location_address: vendor.location_address,
    gst_hst_registered: (vendor as { gst_hst_registered?: boolean }).gst_hst_registered,
  })
  if (connectReconciled?.stripe_connect_completed) {
    vendor.stripe_connect_completed = true
  }

  // KPI data
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const activityWindow = new Date(now.getTime() - 30 * 86400000).toISOString()

  const [
    sessionsRes,
    bookingsRes,
    recentBookingsRes,
    vendorSessionsRes,
    activityCreatedRes,
    activityRefundRes,
    capacityRes,
    calendarConnectionsRes,
  ] = await Promise.all([
    admin
      .from('events')
      .select('id', { count: 'exact' })
      .eq('vendor_profile_id', vendor.id)
      .in('booking_status', ['published', 'fully_booked']),
    admin
      .from('bookings')
      .select('amount_cad, net_vendor_cad, status, refunded_at')
      .eq('vendor_id', vendor.id)
      .gte('created_at', monthStart)
      .in('status', [
        'confirmed',
        'pending',
        'booked',
        'pending_confirmation',
        'attended',
        'refunded',
      ]),
    admin
      .from('bookings')
      .select('id, name, session_title:event_id(title), created_at, amount_cad, net_vendor_cad, status, refunded_at')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false })
      .limit(8),
    admin
      .from('events')
      .select('id, title, date, max_attendees, available_slots, duration_minutes, booking_status')
      .eq('vendor_profile_id', vendor.id)
      .order('date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('bookings')
      .select('id, created_at, status, refunded_at')
      .eq('vendor_id', vendor.id)
      .gte('created_at', activityWindow),
    admin
      .from('bookings')
      .select('id, created_at, status, refunded_at')
      .eq('vendor_id', vendor.id)
      .not('refunded_at', 'is', null)
      .gte('refunded_at', activityWindow),
    admin
      .from('events')
      .select('available_slots')
      .eq('vendor_profile_id', vendor.id)
      .in('booking_status', ['published', 'fully_booked']),
    admin
      .from('vendor_calendar_connections')
      .select('provider')
      .eq('vendor_id', vendor.id)
      .limit(1),
  ])

  const activeSessions = sessionsRes.count ?? 0
  const monthlyRows = bookingsRes.data ?? []
  const monthlyBookings = monthlyRows.length
  // Payouts exclude refunded rows (fees policy: net to vendor on kept bookings only).
  const monthlyRevenue = monthlyRows.reduce(
    (
      sum: number,
      b: {
        amount_cad?: number | null
        net_vendor_cad?: number | null
        status?: string | null
        refunded_at?: string | null
      }
    ) => {
      const st = (b.status ?? '').toLowerCase()
      if (st === 'refunded' || b.refunded_at) return sum
      return sum + (b.net_vendor_cad ?? b.amount_cad ?? 0)
    },
    0
  )

  const recentBookings: DashboardBookingRow[] = (recentBookingsRes.data ?? []).map(
    (booking: Record<string, unknown>) => ({
      id: booking.id as string,
      name: (booking.name as string | null) ?? null,
      session_title: (booking.session_title as { title: string } | null) ?? null,
      created_at: booking.created_at as string,
      amount_cad: (booking.amount_cad as number | null) ?? null,
      net_vendor_cad: (booking.net_vendor_cad as number | null) ?? null,
      status: (booking.status as string | null) ?? null,
      refunded_at: (booking.refunded_at as string | null) ?? null,
    })
  )

  const profileBioComplete = Boolean(vendor.bio?.trim())
  const calendarConnected = (calendarConnectionsRes.data ?? []).length > 0
  const taxSettingsConfirmed = vendor.gst_hst_settings_confirmed_at != null

  const checklistItems = [
    { key: 'email_verified', label: 'Verify your email', done: vendor.email_verified, showStripeCta: false, href: null as string | null },
    { key: 'stripe_checkout_completed', label: 'Start free trial', done: vendor.stripe_checkout_completed, showStripeCta: false, href: null },
    {
      key: 'stripe_connect_completed',
      label: 'Set up payout account (Stripe)',
      done: vendor.stripe_connect_completed,
      showStripeCta: !vendor.stripe_connect_completed,
      href: null,
    },
    {
      key: 'workshop_tax_settings',
      label: 'Confirm GST/HST status (Settings)',
      done: taxSettingsConfirmed,
      showStripeCta: false,
      href: taxSettingsConfirmed ? null : '/partners/dashboard/settings',
    },
    {
      key: 'profile_settings_reviewed',
      label: 'Review Settings & add your bio',
      done: profileBioComplete,
      showStripeCta: false,
      href: profileBioComplete ? null : '/partners/dashboard/settings',
    },
    {
      key: 'calendar_connected',
      label: 'Connect your calendar (Google or Outlook)',
      done: calendarConnected,
      showStripeCta: false,
      href: calendarConnected ? null : '/partners/dashboard/calendar',
    },
    {
      key: 'first_session_created',
      label: 'Create your first workshop',
      done: vendor.first_session_created,
      showStripeCta: false,
      href: '/partners/dashboard/sessions?new=1',
    },
  ]

  const allDone = checklistItems.every((c) => c.done)
  const vendorSessions = (vendorSessionsRes.data ?? []) as Array<{
    id: string
    title: string | null
    date: string | null
    max_attendees: number | null
    available_slots: number | null
    duration_minutes: number | null
    booking_status: string | null
  }>
  const trialDays = vendor.status === 'trialing' ? daysUntil(vendor.trial_ends_at) : null

  const activityBookingMap = new Map<string, BookingActivityRow>()
  for (const row of activityCreatedRes.data ?? []) {
    const r = row as BookingActivityRow & { id: string }
    activityBookingMap.set(r.id, { created_at: r.created_at, status: r.status, refunded_at: r.refunded_at })
  }
  for (const row of activityRefundRes.data ?? []) {
    const r = row as BookingActivityRow & { id: string }
    activityBookingMap.set(r.id, { created_at: r.created_at, status: r.status, refunded_at: r.refunded_at })
  }
  const activitySeries30 = buildActivitySeriesFromBookings([...activityBookingMap.values()], 30)

  const spotsRemaining = (capacityRes.data ?? []).reduce((sum: number, ev: { available_slots?: number | null }) => {
    const n = ev.available_slots
    return sum + (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0)
  }, 0)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome back, {vendor.business_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your workshops.
          </p>
        </div>
        <PartnerDashboardHeaderActions
          items={checklistItems}
          allDone={allDone}
          trialDays={trialDays}
          openGettingStartedInitially={onboarding === '1' && !allDone}
        />
      </div>

      {vendor.status === 'past_due' && (
        <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-800">
          <AlertTriangle />
          <AlertTitle>Payment failed</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>Please update your payment method to avoid suspension.</p>
            <Button
              asChild
              size="sm"
              variant="secondary"
              className="h-8 shrink-0 bg-red-100 text-red-800 hover:bg-red-200"
            >
              <Link href="/partners/dashboard/settings">Update card</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!vendor.stripe_connect_completed && vendor.stripe_checkout_completed && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle className="text-amber-600" />
          <AlertTitle>Set up your payout account</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>Connect Stripe to receive payments from bookings.</p>
            <ConnectStripeButton />
          </AlertDescription>
        </Alert>
      )}

      <DashboardHomeViews
        activeSessions={activeSessions}
        monthlyBookings={monthlyBookings}
        monthlyRevenueCad={monthlyRevenue}
        spotsRemaining={spotsRemaining}
        activitySeries30={activitySeries30}
        workshops={vendorSessions}
        recentBookings={recentBookings}
      />
    </div>
  )
}
