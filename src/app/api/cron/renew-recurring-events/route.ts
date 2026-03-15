import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const ONE_WEEK_MS = 7 * ONE_DAY_MS

/**
 * Compute the next occurrence (same time of day) on or after now.
 * For daily: add 1 day until >= now; for weekly: add 7 days until >= now.
 */
function nextOccurrence(currentDate: Date, recurrence: 'daily' | 'weekly', now: Date): Date {
  const d = new Date(currentDate.getTime())
  if (recurrence === 'daily') {
    while (d.getTime() < now.getTime()) d.setTime(d.getTime() + ONE_DAY_MS)
  } else {
    while (d.getTime() < now.getTime()) d.setTime(d.getTime() + ONE_WEEK_MS)
  }
  return d
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    if (!admin) {
      const msg = 'Admin client unavailable. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.'
      console.error('Cron renew-recurring-events:', msg)
      return NextResponse.json({ error: msg, renewed: 0 }, { status: 500 })
    }

    const now = new Date()

    const { data: events, error: fetchError } = await admin
      .from('events')
      .select('id, date, recurrence')
      .in('recurrence', ['daily', 'weekly'])
      .lt('date', now.toISOString())

    if (fetchError) {
      console.error('Cron renew-recurring-events fetch error:', fetchError)
      return NextResponse.json({ error: fetchError.message, renewed: 0 }, { status: 500 })
    }

    let renewed = 0
    for (const row of events ?? []) {
      const eventDate = row.date ? new Date(row.date) : null
      if (!eventDate || isNaN(eventDate.getTime())) continue

      const recurrence = row.recurrence === 'daily' ? 'daily' : 'weekly'
      const next = nextOccurrence(eventDate, recurrence, now)
      const nextIso = next.toISOString()

      const { error: updateError } = await admin
        .from('events')
        .update({ date: nextIso })
        .eq('id', row.id)

      if (updateError) {
        console.error('Cron renew-recurring-events update error:', updateError, 'event id:', row.id)
        continue
      }
      renewed++
    }

    return NextResponse.json({ renewed, total: events?.length ?? 0 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Cron renew-recurring-events uncaught error:', err)
    return NextResponse.json({ error: message, renewed: 0 }, { status: 500 })
  }
}
