import type { SupabaseClient } from '@supabase/supabase-js'
import {
  sendConsumerBookingConfirmation,
  sendVendorBookingNotification,
  sendVendorFullyBooked,
  type BookingEmailParams,
} from '@/lib/emails'

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

type EventRow = {
  id: number | string
  title: string
  duration_minutes: number | null
  location: string | null
  date: string | null
  booking_status: string | null
}

type VendorProfileRow = {
  business_name: string | null
  website_url: string | null
}

type BookingRow = {
  id: string
  email: string
  name: string
  session_starts_at: string | null
  amount_cad?: number | null
  total_cad?: number | null
  ics_sent?: boolean | null
}

export function resolveBookingSessionDate(
  sessionStartsAt: string | null | undefined,
  eventDateIso: string | null | undefined
): Date {
  const candidates = [sessionStartsAt, eventDateIso].filter(Boolean) as string[]
  for (const raw of candidates) {
    const d = new Date(raw)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

export async function deliverBookingConfirmationEmails(
  admin: SupabaseClient,
  booking: BookingRow,
  event: EventRow,
  vendorProfile: VendorProfileRow | null,
  vendorEmail: string | null,
  options: { amountCad: number; fullyBooked: boolean }
): Promise<void> {
  const sessionDate = resolveBookingSessionDate(booking.session_starts_at, event.date)
  const durationMinutes = (event.duration_minutes ?? 60) as number

  const emailParams: BookingEmailParams = {
    attendeeName: booking.name,
    attendeeEmail: booking.email,
    sessionTitle: event.title,
    vendorName: vendorProfile?.business_name ?? 'offhrs',
    sessionDate,
    durationMinutes,
    location: event.location,
    vendorWebsite: vendorProfile?.website_url ?? null,
    bookingRef: booking.id,
    amountCad: options.amountCad,
  }

  const sessionDateLabel = sessionDate.toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  await Promise.all([
    sendConsumerBookingConfirmation(emailParams),
    vendorEmail
      ? sendVendorBookingNotification(vendorEmail, {
          businessName: vendorProfile?.business_name ?? 'offhrs',
          attendeeName: booking.name,
          attendeeEmail: booking.email,
          sessionTitle: event.title,
          sessionDate: sessionDateLabel,
          amountCad: options.amountCad,
          dashboardUrl: `${APP_URL}/partners/dashboard/bookings`,
        })
      : Promise.resolve(),
    options.fullyBooked && vendorEmail
      ? sendVendorFullyBooked(vendorEmail, event.title, `${APP_URL}/partners/dashboard/bookings`)
      : Promise.resolve(),
  ])

  const { error: markError } = await admin
    .from('bookings')
    .update({ ics_sent: true })
    .eq('id', booking.id)

  if (markError) {
    throw new Error(`Failed to mark ics_sent: ${markError.message}`)
  }
}

/** Re-send confirmation emails when a booking exists but ics_sent is still false (retry / duplicate confirm). */
export async function retryBookingConfirmationEmailsIfNeeded(
  admin: SupabaseClient,
  bookingId: string
): Promise<{ emailsSent: boolean; retried: boolean }> {
  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .select('id, email, name, event_id, session_starts_at, amount_cad, total_cad, ics_sent, vendor_id')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    throw new Error(bookingError?.message ?? 'Booking not found')
  }

  if (booking.ics_sent) {
    return { emailsSent: true, retried: false }
  }

  const { data: event, error: eventError } = await admin
    .from('events')
    .select('id, title, duration_minutes, location, date, booking_status')
    .eq('id', booking.event_id)
    .single()

  if (eventError || !event) {
    throw new Error(eventError?.message ?? 'Event not found for booking')
  }

  const vendorId = booking.vendor_id as string | null
  let vendorProfile: VendorProfileRow | null = null
  let vendorEmail: string | null = null

  if (vendorId) {
    const { data: vp } = await admin
      .from('vendor_profiles')
      .select('business_name, website_url, user_id')
      .eq('id', vendorId)
      .single()
    vendorProfile = vp

    if (vp?.user_id) {
      const { data: authUser } = await admin.auth.admin.getUserById(vp.user_id)
      vendorEmail = authUser?.user?.email ?? null
    }
  }

  const amountCad =
    (booking.total_cad != null && booking.total_cad > 0
      ? Number(booking.total_cad)
      : Number(booking.amount_cad ?? 0)) || 0

  await deliverBookingConfirmationEmails(admin, booking, event, vendorProfile, vendorEmail, {
    amountCad,
    fullyBooked: event.booking_status === 'fully_booked',
  })

  return { emailsSent: true, retried: true }
}
