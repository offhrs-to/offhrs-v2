import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkshopConfirmationHtml } from '@/lib/workshop-confirmation-email'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

/** Send window: event_date + 24h must fall in [now - 2h, now + 1h] so we catch due emails and allow slight delay. */
const WINDOW_MS_BACK = 2 * 60 * 60 * 1000
const WINDOW_MS_FORWARD = 1 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    if (!admin) {
      const msg = 'Admin client unavailable. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel → Settings → Environment Variables (Production).'
      console.error('Cron send-confirmation-emails:', msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    if (!process.env.RESEND_API_KEY) {
      const msg = 'RESEND_API_KEY not set. Add it in Vercel → Settings → Environment Variables (Production).'
      console.error('Cron send-confirmation-emails:', msg)
      return NextResponse.json({ sent: 0, error: msg }, { status: 500 })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
  const from = process.env.RESEND_FROM_EMAIL || 'Offhrs <onboarding@resend.dev>'

  const now = Date.now()
  const windowStart = new Date(now - WINDOW_MS_BACK)
  const windowEnd = new Date(now + WINDOW_MS_FORWARD)

  const { data: bookings, error: fetchError } = await admin
    .from('bookings')
    .select('id, user_id, confirmation_token, events(date, title)')
    .eq('status', 'booked')
    .is('confirmation_email_sent_at', null)

  if (fetchError) {
    console.error('Cron send-confirmation-emails fetch error:', fetchError)
    return NextResponse.json({ error: fetchError.message, sent: 0 }, { status: 500 })
  }

  const dueBookings: Array<{
    id: string
    user_id: string
    confirmation_token: string | null
    eventName: string
    confirmUrl: string
  }> = []

  for (const b of bookings ?? []) {
    const row = b as Record<string, unknown>
    const event = (row.events ?? row.event) as { date: string; title: string } | null
    if (!event?.date || !b.confirmation_token) continue
    const eventDate = new Date(event.date)
    const send24h = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000)
    if (send24h < windowStart || send24h > windowEnd) continue
    const eventName = event.title?.trim() || 'your workshop'
    const confirmUrl = `${APP_URL}/api/confirm-attendance?token=${b.confirmation_token}`
    dueBookings.push({
      id: b.id,
      user_id: b.user_id,
      confirmation_token: b.confirmation_token,
      eventName,
      confirmUrl,
    })
  }

  let sent = 0
  let errors = 0

  for (const row of dueBookings) {
    const { data: userData } = await admin.auth.admin.getUserById(row.user_id)
    const email = userData?.user?.email
    if (!email) {
      errors++
      continue
    }

    const { error: sendError } = await resend.emails.send({
      from,
      to: email,
      subject: `Confirm your attendance – ${row.eventName}`,
      html: getWorkshopConfirmationHtml({
        eventName: row.eventName,
        confirmUrl: row.confirmUrl,
        headline: 'Confirm your workshop attendance',
        bodyLine:
          'Hope you enjoyed the workshop! Click below to confirm you attended and earn experience points.',
        ctaText: 'Confirm I attended',
      }),
    })

    if (sendError) {
      console.error('Cron send-confirmation-emails Resend error:', sendError)
      errors++
      continue
    }

    const { error: updateError } = await admin
      .from('bookings')
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq('id', row.id)

    if (updateError) {
      console.error('Cron send-confirmation-emails update error:', updateError)
      errors++
      continue
    }
    sent++
  }

  return NextResponse.json({ sent, errors })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Cron send-confirmation-emails uncaught error:', err)
    return NextResponse.json({ error: message, sent: 0 }, { status: 500 })
  }
}

