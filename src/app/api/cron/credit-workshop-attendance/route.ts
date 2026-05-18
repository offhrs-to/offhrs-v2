import { createAdminClient } from '@/lib/supabase/admin'
import { creditDueWorkshopAttendances } from '@/lib/workshop-attendance-credit'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Hourly cron: after a confirmed booking's workshop end time has passed (and it was not
 * refunded/cancelled), mark attended and award experience points automatically.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })
    }

    const result = await creditDueWorkshopAttendances(admin)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Cron credit-workshop-attendance error:', err)
    return NextResponse.json({ error: message, credited: 0 }, { status: 500 })
  }
}
