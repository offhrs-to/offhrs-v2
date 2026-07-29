import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { archivePartnerSession } from '@/lib/partner-session-archive'
import { scheduleVendorSessionCalendarSyncBatch } from '@/lib/vendor-calendar-sync'

const bulkSchema = z.object({
  ids: z.array(z.coerce.string().min(1)).min(1).max(100),
  action: z.enum(['archive', 'publish', 'draft']),
})

function effectiveBookingStatus(row: {
  booking_status?: string | null
  status?: string | null
}): string {
  return String(row.booking_status ?? row.status ?? '')
    .trim()
    .toLowerCase()
}

function isAlreadyTargetStatus(current: string, action: 'publish' | 'draft'): boolean {
  if (action === 'publish') return current === 'published'
  return current === 'draft'
}

async function getVendor(userId: string) {
  const admin = createAdminClient()
  if (!admin) return { admin: null, vendor: null }

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  return { admin, vendor }
}

// POST /api/partners/sessions/bulk — bulk status changes
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { admin, vendor } = await getVendor(user.id)
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    const parsed = bulkSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { ids, action } = parsed.data
    const uniqueIds = [...new Set(ids)]

    const { data: rows, error: fetchError } = await admin
      .from('events')
      .select('id, booking_status, status')
      .eq('vendor_profile_id', vendor.id)
      .in('id', uniqueIds.map((id) => Number(id)).filter((n) => Number.isFinite(n)))

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const rowById = new Map((rows ?? []).map((r) => [String(r.id), r]))
    const succeeded: string[] = []
    const skipped: { id: string; reason: string }[] = []
    const failed: { id: string; error: string }[] = []
    const calendarSyncIds: string[] = []
    let totalRefunded = 0

    for (const id of uniqueIds) {
      const row = rowById.get(id)
      if (!row) {
        failed.push({ id, error: 'Session not found' })
        continue
      }

      const status = effectiveBookingStatus(row)

      if (action === 'archive') {
        if (status === 'archived') {
          skipped.push({ id, reason: 'Already archived' })
          continue
        }
        const result = await archivePartnerSession(admin, vendor.id, id)
        if (result.ok) {
          succeeded.push(id)
          totalRefunded += result.refunded
        } else {
          failed.push({ id, error: result.error })
        }
        continue
      }

      const targetStatus = action === 'publish' ? 'published' : 'draft'

      if (isAlreadyTargetStatus(status, action)) {
        skipped.push({ id, reason: `Already ${targetStatus}` })
        continue
      }

      const { data: updated, error: updateError } = await admin
        .from('events')
        .update({ booking_status: targetStatus })
        .eq('id', Number(id))
        .eq('vendor_profile_id', vendor.id)
        .select('id')
        .maybeSingle()

      if (updateError || !updated) {
        failed.push({ id, error: updateError?.message ?? 'Update failed' })
        continue
      }

      calendarSyncIds.push(id)
      succeeded.push(id)
    }

    scheduleVendorSessionCalendarSyncBatch(admin, vendor.id, calendarSyncIds)

    return NextResponse.json({
      action,
      succeeded,
      skipped,
      failed,
      refunded: action === 'archive' ? totalRefunded : undefined,
    })
  } catch (err) {
    console.error('Bulk session update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
