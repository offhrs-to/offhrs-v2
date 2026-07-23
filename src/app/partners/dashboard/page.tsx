import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { ConnectStripeButton } from './components/ConnectStripeButton'
import { PartnerDashboardHeaderActions } from './components/PartnerDashboardHeaderActions'
import {
  DashboardHomeViews,
  type DashboardBookingRow,
} from './components/DashboardHomeViews'
import { repairOrphanedStripeRefundsForVendor } from '@/lib/booking-refund'
import { reconcileVendorEventSlots } from '@/lib/event-slot-reconcile'
import { reconcileStripeConnectStatus } from '@/lib/stripe-connect-reconcile'
import { buildActivitySeriesFromBookings, type BookingActivityRow } from '@/lib/partner-dashboard-activity'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

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
      .in('status', ['confirmed', 'pending', 'booked', 'pending_confirmation']),
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
  const monthlyBookings = bookingsRes.data?.length ?? 0
  // Show vendor payouts net of Stripe fees (per policy, fees are absorbed by the vendor).
  // Falls back to the gross charge if a row is missing net_vendor_cad (e.g. legacy bookings).
  const monthlyRevenue =
    bookingsRes.data?.reduce(
      (sum: number, b: { amount_cad?: number | null; net_vendor_cad?: number | null }) =>
        sum + (b.net_vendor_cad ?? b.amount_cad ?? 0),
      0
    ) ?? 0

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
