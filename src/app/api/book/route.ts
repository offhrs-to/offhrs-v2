import { bookBodySchema } from '@/lib/api-validation'
import { createClient } from '@/lib/supabase/server'
import { getRateLimitKey, rateLimit } from '@/lib/rate-limit'
import { getWorkshopConfirmationHtml } from '@/lib/workshop-confirmation-email'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { randomUUID } from 'crypto'

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

const BOOK_RATE_LIMIT = 15 // per minute per IP
/** Resend allows scheduling up to 30 days ahead. */
const MAX_SCHEDULE_DAYS = 30

export async function POST(request: NextRequest) {
  try {
    const key = getRateLimitKey(request)
    if (!rateLimit(`book:${key}`, BOOK_RATE_LIMIT)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

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

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    const { event_id, event_title } = parsed.data

    const confirmationToken = randomUUID()

    const { data: eventRow } = await supabase
      .from('events')
      .select('date, title')
      .eq('id', event_id)
      .single()

    const eventName = event_title || eventRow?.title || 'your workshop'

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

    const confirmUrl = `${APP_URL}/api/confirm-attendance?token=${confirmationToken}`

    if (process.env.RESEND_API_KEY && user.email) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const from = process.env.RESEND_FROM_EMAIL || 'Offhrs <onboarding@resend.dev>'
      const eventDate = eventRow?.date ? new Date(eventRow.date) : null
      const send24hAfter = eventDate
        ? new Date(eventDate.getTime() + 24 * 60 * 60 * 1000)
        : null
      const now = new Date()
      const maxSchedule = new Date(now.getTime() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000)
      const canSchedule =
        send24hAfter &&
        send24hAfter > now &&
        send24hAfter <= maxSchedule

      if (canSchedule) {
        await resend.emails.send({
          from,
          to: user.email,
          subject: `Confirm your attendance – ${eventName}`,
          html: getWorkshopConfirmationHtml({
            eventName,
            confirmUrl,
            headline: 'Confirm your workshop attendance',
            bodyLine:
              'Hope you enjoyed the workshop! Click below to confirm you attended and earn experience points.',
            ctaText: 'Confirm I attended',
          }),
          scheduledAt: send24hAfter.toISOString(),
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Book API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
