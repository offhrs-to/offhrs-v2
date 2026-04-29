import { bookBodySchema } from '@/lib/api-validation'
import { logSecurityEvent } from '@/lib/security-monitor'
import { createClient } from '@/lib/supabase/server'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const BOOK_RATE_LIMIT = 15 // per minute per IP (and per user when authenticated)

export async function POST(request: NextRequest) {
  try {
    // Resolve user first for IP + user-based rate limiting (OWASP API4)
    let supabase = await createClient()
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
      supabase = client
    }

    const key = getRateLimitKey(request, user?.id)
    const rl = consumeRateLimit(`book:${key}`, BOOK_RATE_LIMIT)
    if (!rl.allowed) {
      logSecurityEvent('warn', {
        type: 'rate_limited',
        route: '/api/book',
        ipKey: key,
      })
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    const raw = await request.json()
    if (typeof raw !== 'object' || raw === null) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }
    const parsed = bookBodySchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const { event_id } = parsed.data

    // Record redirect for admin count (logged-in and guest)
    const { error: redirectError } = await supabase.from('event_redirects').insert({
      event_id,
      user_id: user?.id ?? null,
    })
    if (redirectError) {
      console.error('Event redirect insert error:', redirectError)
    }

    // Guest: only count redirect, then success
    if (!user) {
      return NextResponse.json({ success: true })
    }

    const confirmationToken = randomUUID()

    const { error: insertError } = await supabase
      .from('bookings')
      .upsert(
        {
          user_id: user.id,
          event_id,
          status: 'booked',
          confirmation_token: confirmationToken,
        },
        { onConflict: 'user_id,event_id' }
      )

    if (insertError) {
      console.error('Booking insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Book API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
