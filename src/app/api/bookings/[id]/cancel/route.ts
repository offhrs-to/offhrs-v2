import { processBookingRefund } from '@/lib/booking-refund'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

async function resolveUser(request: NextRequest) {
  const supabase = await createClient()
  let user = (await supabase.auth.getUser()).data.user

  const authHeader = request.headers.get('authorization')
  if (!user && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { createClient: createSupabase } = await import('@supabase/supabase-js')
    const client = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    user = (await client.auth.getUser()).data.user
  }

  return user
}

/**
 * POST /api/bookings/[id]/cancel
 * Consumer cancels a confirmed booking and receives a full refund when within the vendor refund window.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id: bookingId } = await params
  const user = await resolveUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const result = await processBookingRefund(admin, bookingId, {
    initiatedBy: 'consumer',
    cancellationReason: 'Cancelled by attendee',
    consumerUserId: user.id,
    consumerEmail: user.email ?? null,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true })
}
