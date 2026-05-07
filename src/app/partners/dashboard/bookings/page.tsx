import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'

interface Booking {
  id: string
  name: string | null
  email: string | null
  amount_cad: number | null
  status: string | null
  created_at: string
  event_id: string | null
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-600' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  refunded: { label: 'Refunded', className: 'bg-[#F0EDE8] text-[#888]' },
}

function formatCad(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount)
}

export default async function BookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/partners/login')

  const admin = createAdminClient()
  if (!admin) return <div className="p-8 text-red-500">Server configuration error</div>

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!vendor) redirect('/partners/signup')

  const { data: bookings } = await admin
    .from('bookings')
    .select('id, name, email, amount_cad, status, created_at, event_id')
    .eq('vendor_id', vendor.id)
    .order('created_at', { ascending: false })
    .limit(100) as { data: Booking[] | null }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">Bookings</h1>
          <p className="text-sm text-[#888] mt-1">All bookings for your workshop sessions.</p>
        </div>
      </div>

      {!bookings?.length ? (
        <div className="text-center py-16 bg-white border border-[#E8E4DE] rounded-xl">
          <Users className="w-10 h-10 text-[#C8BFB0] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#1a1a1a]">No bookings yet</p>
          <p className="text-xs text-[#888] mt-1">
            Bookings from consumers will appear here once you publish a session.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#E8E4DE] rounded-xl overflow-hidden">
          <div className="grid grid-cols-5 gap-4 px-5 py-3 border-b border-[#F0EDE8] text-xs font-medium text-[#888]">
            <span className="col-span-2">Attendee</span>
            <span>Date</span>
            <span>Amount</span>
            <span>Status</span>
          </div>
          {bookings.map((booking) => {
            const badge = STATUS_BADGE[booking.status ?? ''] ?? { label: booking.status ?? 'Unknown', className: 'bg-[#F0EDE8] text-[#888]' }
            return (
              <div
                key={booking.id}
                className="grid grid-cols-5 gap-4 px-5 py-3.5 border-b border-[#F5F2EE] last:border-0 items-center"
              >
                <div className="col-span-2 min-w-0">
                  <p className="text-sm font-medium text-[#1a1a1a] truncate">{booking.name ?? 'Guest'}</p>
                  <p className="text-xs text-[#888] truncate">{booking.email ?? ''}</p>
                </div>
                <span className="text-sm text-[#555]">
                  {new Date(booking.created_at).toLocaleDateString('en-CA', {
                    month: 'short', day: 'numeric',
                  })}
                </span>
                <span className="text-sm font-medium text-[#1a1a1a]">
                  {booking.amount_cad ? formatCad(booking.amount_cad) : '—'}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${badge.className}`}>
                  {badge.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
