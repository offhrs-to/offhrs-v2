import { bookBodySchema } from '@/lib/api-validation'
import { createClient } from '@/lib/supabase/server'
import { getRateLimitKey, rateLimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { randomUUID } from 'crypto'

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

const BOOK_RATE_LIMIT = 15 // per minute per IP

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
    const eventName = event_title || 'your workshop'

    if (process.env.RESEND_API_KEY && user.email) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Offhrs <onboarding@resend.dev>',
        to: user.email,
        subject: `Confirm your workshop attendance`,
        html: `
          <p>You booked <strong>${eventName}</strong>.</p>
          <p>After attending, click below to confirm and earn experience points:</p>
          <p><a href="${confirmUrl}">Confirm I attended</a></p>
          <p>This link expires when used.</p>
        `,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Book API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
