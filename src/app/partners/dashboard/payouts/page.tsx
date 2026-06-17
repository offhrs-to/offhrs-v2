import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ExternalLink, DollarSign } from 'lucide-react'
import { OpenStripeExpressButton } from './OpenStripeExpressButton'
import { ConnectStripeButton } from '../components/ConnectStripeButton'
import { reconcileStripeConnectStatus } from '@/lib/stripe-connect-reconcile'

interface Payout {
  id: string
  stripe_payout_id: string
  amount_cad: number
  arrival_date: string
  status: string
  created_at: string
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-600' },
  canceled: { label: 'Canceled', className: 'bg-[#F0EDE8] text-[#888]' },
}

function formatCad(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount)
}

export default async function PayoutsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/partners/login')

  const admin = createAdminClient()
  if (!admin) return <div className="p-8 text-red-500">Server configuration error</div>

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id, stripe_account_id, stripe_connect_completed, location_address, gst_hst_registered')
    .eq('user_id', user.id)
    .single() as {
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

  const { data: payouts } = await admin
    .from('vendor_payouts')
    .select('*')
    .eq('vendor_id', vendor.id)
    .order('arrival_date', { ascending: false })
    .limit(50) as { data: Payout[] | null }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">Payouts</h1>
          <p className="text-sm text-[#888] mt-1">Your payout history from workshop bookings.</p>
        </div>
        {vendor.stripe_connect_completed && <OpenStripeExpressButton />}
      </div>

      {!vendor.stripe_connect_completed ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex gap-4">
          <ExternalLink className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 mb-1">Payout account not set up</p>
            <p className="text-sm text-amber-700 mb-4">
              You need to complete Stripe Connect onboarding before you can receive payouts.
              This takes about 2 minutes.
            </p>
            <ConnectStripeButton />
          </div>
        </div>
      ) : !payouts?.length ? (
        <div className="text-center py-16 bg-white border border-[#E8E4DE] rounded-xl">
          <DollarSign className="w-10 h-10 text-[#C8BFB0] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#1a1a1a]">No payouts yet</p>
          <p className="text-xs text-[#888] mt-1">Payouts appear here once bookings are completed.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E8E4DE] rounded-xl overflow-hidden">
          <div className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-[#F0EDE8] text-xs font-medium text-[#888]">
            <span>Amount</span>
            <span>Arrival date</span>
            <span>Status</span>
            <span>Payout ID</span>
          </div>
          {payouts.map((payout) => {
            const badge = STATUS_BADGE[payout.status] ?? { label: payout.status, className: 'bg-[#F0EDE8] text-[#888]' }
            return (
              <div
                key={payout.id}
                className="grid grid-cols-4 gap-4 px-5 py-3.5 border-b border-[#F5F2EE] last:border-0 items-center"
              >
                <span className="text-sm font-semibold text-[#1a1a1a]">{formatCad(payout.amount_cad)}</span>
                <span className="text-sm text-[#555]">
                  {new Date(payout.arrival_date).toLocaleDateString('en-CA', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${badge.className}`}>
                  {badge.label}
                </span>
                <span className="text-xs text-[#888] font-mono truncate">{payout.stripe_payout_id}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
