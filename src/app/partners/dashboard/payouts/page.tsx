import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ExternalLink, DollarSign } from 'lucide-react'
import { OpenStripeExpressButton } from './OpenStripeExpressButton'
import { ConnectStripeButton } from '../components/ConnectStripeButton'
import { reconcileStripeConnectStatus } from '@/lib/stripe-connect-reconcile'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PartnerEmptyState } from '../components/PartnerEmptyState'
import { cn } from '@/lib/utils'
import Stripe from 'stripe'

interface PayoutRow {
  id: string
  stripe_payout_id: string
  amount_cad: number
  arrival_date: string
  status: string
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-transparent bg-amber-100 text-amber-700' },
  in_transit: { label: 'In transit', className: 'border-transparent bg-amber-100 text-amber-700' },
  paid: { label: 'Paid', className: 'border-transparent bg-green-100 text-green-700' },
  failed: { label: 'Failed', className: 'border-transparent bg-red-100 text-red-600' },
  canceled: { label: 'Canceled', className: 'border-transparent bg-partner-muted text-muted-foreground' },
  cancelled: { label: 'Canceled', className: 'border-transparent bg-partner-muted text-muted-foreground' },
}

function formatCad(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount)
}

function stripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder', {
    apiVersion: '2026-04-22.dahlia',
  })
}

async function loadConnectBalanceCad(accountId: string): Promise<{
  availableCad: number
  pendingCad: number
} | null> {
  try {
    const bal = await stripe().balance.retrieve({}, { stripeAccount: accountId })
    const sum = (buckets: Stripe.Balance.Available[] | Stripe.Balance.Pending[]) =>
      buckets.filter((b) => b.currency === 'cad').reduce((acc, b) => acc + b.amount, 0) / 100
    return {
      availableCad: sum(bal.available),
      pendingCad: sum(bal.pending),
    }
  } catch (err) {
    console.error('payouts balance.retrieve', err)
    return null
  }
}

/** Prefer live Stripe payouts; upsert into vendor_payouts and drop stale local-only rows from the UI. */
async function loadReconciledPayouts(params: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>
  vendorId: string
  accountId: string
}): Promise<PayoutRow[]> {
  const { admin, vendorId, accountId } = params
  try {
    const listed = await stripe().payouts.list({ limit: 50 }, { stripeAccount: accountId })
    const rows: PayoutRow[] = []
    for (const p of listed.data) {
      const arrival = new Date(p.arrival_date * 1000).toISOString().slice(0, 10)
      const amountCad = p.amount / 100
      const status = p.status
      await admin.from('vendor_payouts').upsert(
        {
          vendor_id: vendorId,
          stripe_payout_id: p.id,
          amount_cad: amountCad,
          arrival_date: arrival,
          status,
        },
        { onConflict: 'stripe_payout_id' }
      )
      rows.push({
        id: p.id,
        stripe_payout_id: p.id,
        amount_cad: amountCad,
        arrival_date: arrival,
        status,
      })
    }
    return rows
  } catch (err) {
    console.error('payouts.list reconcile', err)
    const { data } = await admin
      .from('vendor_payouts')
      .select('id, stripe_payout_id, amount_cad, arrival_date, status')
      .eq('vendor_id', vendorId)
      .order('arrival_date', { ascending: false })
      .limit(50)
    return (data as PayoutRow[] | null) ?? []
  }
}

export default async function PayoutsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/partners/login')

  const admin = createAdminClient()
  if (!admin) return <div className="p-8 text-red-500">Server configuration error</div>

  const { data: vendor } = (await admin
    .from('vendor_profiles')
    .select('id, stripe_account_id, stripe_connect_completed, location_address, gst_hst_registered')
    .eq('user_id', user.id)
    .single()) as {
    data: {
      id: string
      stripe_account_id: string | null
      stripe_connect_completed: boolean
      location_address: string | null
      gst_hst_registered: boolean
    } | null
  }

  if (!vendor) redirect('/partners/signup')

  const reconciled = await reconcileStripeConnectStatus(admin, vendor)
  if (reconciled?.stripe_connect_completed) {
    vendor.stripe_connect_completed = true
  }

  const balance =
    vendor.stripe_connect_completed && vendor.stripe_account_id
      ? await loadConnectBalanceCad(vendor.stripe_account_id)
      : null

  const payouts =
    vendor.stripe_connect_completed && vendor.stripe_account_id
      ? await loadReconciledPayouts({
          admin,
          vendorId: vendor.id,
          accountId: vendor.stripe_account_id,
        })
      : []

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payouts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bank transfers from Stripe (history). This is not your current earnings after refunds.
          </p>
        </div>
        {vendor.stripe_connect_completed && <OpenStripeExpressButton />}
      </div>

      {!vendor.stripe_connect_completed ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <ExternalLink className="text-amber-500" />
          <AlertTitle>Payout account not set up</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>
              You need to complete Stripe Connect onboarding before you can receive payouts. This takes about 2
              minutes.
            </p>
            <ConnectStripeButton />
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          {balance ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="border-partner-border shadow-none">
                <CardContent className="px-5 py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Available in Stripe
                  </p>
                  <p className="mt-1 text-xl font-semibold text-foreground">
                    {formatCad(balance.availableCad)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-partner-border shadow-none">
                <CardContent className="px-5 py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pending in Stripe
                  </p>
                  <p className="mt-1 text-xl font-semibold text-foreground">
                    {formatCad(balance.pendingCad)}
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          <Alert className="border-partner-border bg-partner-canvas/60">
            <AlertTitle className="text-sm">How to read this page</AlertTitle>
            <AlertDescription className="text-sm text-muted-foreground">
              Past bank transfers stay listed even if a booking or Marketplace order was later refunded.
              Refunds adjust your Stripe balance; they do not erase an earlier payout that already arrived in
              your bank. Use <strong>Available in Stripe</strong> above (or Open Stripe dashboard) for what you
              have left now.
            </AlertDescription>
          </Alert>

          {!payouts.length ? (
            <Card className="border-partner-border py-0 shadow-none">
              <PartnerEmptyState
                icon={DollarSign}
                title="No bank transfers yet"
                description="When Stripe pays out your Connect balance to your bank, those transfers appear here."
              />
            </Card>
          ) : (
            <Card className="gap-0 overflow-hidden border-partner-border py-0 shadow-none">
              <div className="hidden grid-cols-4 gap-4 border-b border-partner-border px-5 py-3 text-xs font-medium text-muted-foreground sm:grid">
                <span>Amount</span>
                <span>Arrival date</span>
                <span>Status</span>
                <span>Payout ID</span>
              </div>
              {payouts.map((payout) => {
                const badge = STATUS_BADGE[payout.status] ?? {
                  label: payout.status,
                  className: 'border-transparent bg-partner-muted text-muted-foreground',
                }
                const arrival = new Date(payout.arrival_date).toLocaleDateString('en-CA', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'America/Toronto',
                })
                return (
                  <div
                    key={payout.stripe_payout_id}
                    className="grid grid-cols-1 gap-2 border-b border-partner-border/80 px-5 py-3.5 last:border-0 sm:grid-cols-4 sm:items-center sm:gap-4"
                  >
                    <div className="flex items-center justify-between gap-3 sm:block">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
                        Amount
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {formatCad(payout.amount_cad)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:block">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
                        Arrival
                      </span>
                      <span className="text-sm text-muted-foreground">{arrival}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:block">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
                        Status
                      </span>
                      <Badge variant="outline" className={cn('w-fit', badge.className)}>
                        {badge.label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:block">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
                        Payout ID
                      </span>
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {payout.stripe_payout_id}
                      </span>
                    </div>
                  </div>
                )
              })}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
