import { verifyAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

/** GET /api/admin/marketplace-qa — sellers awaiting Marketplace review. */
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const status = request.nextUrl.searchParams.get('status') ?? 'pending_review'

  const { data, error } = await admin
    .from('vendor_profiles')
    .select(
      'id, business_name, email_verified, marketplace_plan, marketplace_qa_status, marketplace_enrolled_at, ship_from_city, ship_from_province, shop_status'
    )
    .eq('marketplace_enabled', true)
    .eq('marketplace_qa_status', status)
    .order('marketplace_enrolled_at', { ascending: true })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sellers: data ?? [] })
}

const patchSchema = z.object({
  vendor_id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  notes: z.string().max(2000).optional(),
})

/** POST /api/admin/marketplace-qa — approve or reject a seller. */
export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const parsed = patchSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
  }

  const { vendor_id, action, notes } = parsed.data
  const { error } = await admin
    .from('vendor_profiles')
    .update({
      marketplace_qa_status: action === 'approve' ? 'approved' : 'rejected',
      marketplace_qa_notes: notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', vendor_id)
    .eq('marketplace_enabled', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
