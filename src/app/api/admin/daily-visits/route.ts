import { verifyAdmin } from '@/app/api/admin/login/route'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/admin/daily-visits
 * Returns unique visitor count for today and for each of the last 30 days.
 * Requires admin session cookie or Authorization: Basic.
 */
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured with SUPABASE_SERVICE_ROLE_KEY' },
      { status: 503 }
    )
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30)
  const fromDate = thirtyDaysAgo.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('daily_visits')
    .select('visit_date')
    .gte('visit_date', fromDate)
    .order('visit_date', { ascending: false })

  if (error) {
    console.error('Daily visits error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const countByDate: Record<string, number> = {}
  for (const row of data ?? []) {
    const d = row.visit_date as string
    countByDate[d] = (countByDate[d] ?? 0) + 1
  }

  const today = new Date().toISOString().slice(0, 10)
  const byDay: { date: string; count: number }[] = []
  for (let i = 0; i < 30; i++) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    byDay.push({ date: dateStr, count: countByDate[dateStr] ?? 0 })
  }
  byDay.sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    today: countByDate[today] ?? 0,
    byDay,
  })
}
