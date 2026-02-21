import { verifyAdmin } from '@/app/api/admin/login/route'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const CHECK_TIMEOUT_MS = 12_000

export type CheckLinkResult = {
  eventId: string
  title: string
  url: string
  ok: boolean
  status?: number
  error?: string
}

/**
 * POST /api/admin/check-booking-links
 * Fetches upcoming events with a booking link (external_link), then checks each URL.
 * Returns which links are OK (2xx) vs broken (non-2xx or network error).
 * Requires admin session cookie or Authorization: Basic.
 */
export async function POST(request: NextRequest) {
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

  const now = new Date().toISOString()
  const { data: events, error: fetchError } = await supabase
    .from('events')
    .select('id, title, external_link, date')
    .not('external_link', 'is', null)
    .not('external_link', 'eq', '')
    .or(`date.is.null,date.gte.${now}`)

  if (fetchError) {
    console.error('Check booking links fetch error:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const toCheck = (events ?? []).filter(
    (e) => e.external_link && (e.external_link as string).trim().length > 0
  )

  const results: CheckLinkResult[] = []

  for (const event of toCheck) {
    const url = (event.external_link as string).trim()
    const result: CheckLinkResult = {
      eventId: event.id,
      title: event.title ?? 'Untitled',
      url,
      ok: false,
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'CraftAndCredit-LinkChecker/1.0',
        },
      })
      clearTimeout(timeout)
      result.status = res.status
      result.ok = res.status >= 200 && res.status < 300
    } catch (e: unknown) {
      const err = e as Error & { code?: string }
      result.error = err.name === 'AbortError' ? 'Timeout' : (err.message || String(e))
    }

    results.push(result)
  }

  const okCount = results.filter((r) => r.ok).length
  const brokenCount = results.length - okCount

  return NextResponse.json({
    results,
    summary: {
      total: results.length,
      ok: okCount,
      broken: brokenCount,
    },
  })
}
