import { createAdminClient } from '@/lib/supabase/admin'
import { getRateLimitKey, rateLimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const VISITOR_COOKIE = 'vid'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 // 1 year
const RECORD_VISIT_RATE_LIMIT = 120 // per minute per IP

/**
 * POST /api/record-visit
 * Records a unique visit for today. Uses a cookie-based visitor_id so each browser counts once per day.
 * Call from the webapp (e.g. layout) with credentials: 'include'.
 */
export async function POST(request: NextRequest) {
  const key = getRateLimitKey(request)
  if (!rateLimit(`record-visit:${key}`, RECORD_VISIT_RATE_LIMIT)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let visitorId = request.cookies.get(VISITOR_COOKIE)?.value
  if (!visitorId || visitorId.length > 64) {
    visitorId = randomUUID()
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return new NextResponse(null, { status: 204 })
  }

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC
  await supabase
    .from('daily_visits')
    .upsert(
      { visit_date: today, visitor_id: visitorId },
      { onConflict: 'visit_date,visitor_id', ignoreDuplicates: true }
    )

  const res = new NextResponse(null, { status: 204 })
  res.cookies.set(VISITOR_COOKIE, visitorId, {
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
