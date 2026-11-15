import { verifyAdmin } from '@/lib/admin-auth'
import { deletePartnerVendorById, suspendPartnerVendorById } from '@/lib/partner-account-delete'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const bodySchema = z.object({
  action: z.enum(['remove', 'suspend']),
})

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Admin-only: remove (hard delete) or suspend (soft disable) a partner vendor.
 * Use for abandoned / suspected fraudulent signups that won't respond.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: vendorId } = await context.params
  if (!vendorId || !z.string().uuid().safeParse(vendorId).success) {
    return NextResponse.json({ error: 'Invalid vendor id' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Body must include action: "remove" | "suspend"' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const result =
    parsed.data.action === 'suspend'
      ? await suspendPartnerVendorById(admin, vendorId)
      : await deletePartnerVendorById(admin, vendorId, { initiatedBy: 'admin' })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, stage: result.stage, details: result.details },
      { status: result.status }
    )
  }

  return NextResponse.json({
    success: true,
    action: parsed.data.action,
    vendorId: result.vendorId,
    preservedConsumerAccount: result.preservedConsumerAccount,
  })
}
