import { verifyAdmin } from '@/app/api/admin/login/route'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getMaterializedInstanceDates,
  stripEventRowForInsert,
} from '@/lib/recurring-event-instances'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/admin/backfill-recurring-instances
 * For each event still stored as recurrence daily/weekly (legacy before materialized instances),
 * inserts the extra dated rows and sets recurrence to 'none' on the original row.
 * Idempotent: after running once, no rows match recurrence daily/weekly so nothing happens.
 */
export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: 'Server not configured with SUPABASE_SERVICE_ROLE_KEY' },
      { status: 503 }
    )
  }

  const { data: rows, error: fetchError } = await admin
    .from('events')
    .select('*')
    .in('recurrence', ['daily', 'weekly'])
    .not('date', 'is', null)

  if (fetchError) {
    console.error('backfill-recurring-instances fetch:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  let processed = 0
  let inserted = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of rows ?? []) {
    const pattern = row.recurrence === 'daily' ? 'daily' : 'weekly'
    const eventDate = row.date ? new Date(row.date as string) : null
    if (!eventDate || Number.isNaN(eventDate.getTime())) {
      skipped++
      continue
    }

    const dates = getMaterializedInstanceDates(eventDate, pattern)
    if (dates.length <= 1) {
      skipped++
      continue
    }

    const payload = stripEventRowForInsert(row as Record<string, unknown>)
    const restDates = dates.slice(1)
    const batch = restDates.map((iso) => ({ ...payload, date: iso, recurrence: 'none' }))

    try {
      if (batch.length > 0) {
        const { error: insErr } = await admin.from('events').insert(batch)
        if (insErr) {
          errors.push(`id ${row.id}: ${insErr.message}`)
          continue
        }
        inserted += batch.length
      }

      const { error: upErr } = await admin
        .from('events')
        .update({ recurrence: 'none' })
        .eq('id', row.id)

      if (upErr) {
        errors.push(`id ${row.id} update: ${upErr.message}`)
      } else {
        processed++
      }
    } catch (e) {
      errors.push(`id ${row.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({
    processed,
    inserted,
    skipped,
    totalSourceRows: rows?.length ?? 0,
    errors: errors.length ? errors : undefined,
    message: `Recurring backfill: ${processed} event(s) expanded, ${inserted} new row(s) inserted, ${skipped} skipped.`,
  })
}
