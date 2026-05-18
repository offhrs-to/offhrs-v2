import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processBookingRefund } from '@/lib/booking-refund'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  const { data: booking } = await admin
    .from('bookings')
    .select('id')
    .eq('id', id)
    .eq('vendor_id', vendor.id)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const result = await processBookingRefund(admin, id, {
    initiatedBy: 'vendor',
    cancellationReason: 'Refund issued by vendor',
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true })
}
