import { bookBodySchema } from '@/lib/api-validation'
import { logSecurityEvent } from '@/lib/security-monitor'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { computeSlotDecrementForEvent } from '@/lib/workshop-series'
import { getOrCreateStripeCustomerId } from '@/lib/stripe-consumer-customer'
import {
  calculateWorkshopTicketTax,
  resolveWorkshopCustomerTaxAddress,
} from '@/lib/stripe-workshop-tax'

const BOOK_RATE_LIMIT = 15 // per minute per IP

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

// Extended schema for SaaS bookings
const customerAddressSchema = z.object({
  country: z.string().optional(),
  postal_code: z.string().min(3).max(12),
  state: z.string().max(3).optional(),
  city: z.string().max(120).optional(),
  line1: z.string().max(200).optional(),
})

const saasBookSchema = z.object({
  event_id: z.union([z.string(), z.number()]),
  attendee_name: z.string().min(1).max(120),
  attendee_email: z.string().email(),
  start_time: z.string().optional(), // ISO start time (optional; defaults to session date on server)
  customer_address: customerAddressSchema.optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    let user = (await supabase.auth.getUser()).data.user

    // Support Bearer token auth from mobile
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
    }

    const key = getRateLimitKey(request, user?.id)
    const rl = consumeRateLimit(`book:${key}`, BOOK_RATE_LIMIT)
    if (!rl.allowed) {
      logSecurityEvent('warn', { type: 'rate_limited', route: '/api/book', ipKey: key })
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    const raw = await request.json()

    // Try SaaS booking schema first
    const saasParsed = saasBookSchema.safeParse(raw)

    if (saasParsed.success) {
      const { event_id, attendee_name, attendee_email, start_time, customer_address } = saasParsed.data

      const admin = createAdminClient()
      if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

      // Fetch event with vendor details
      const { data: event } = await admin
        .from('events')
        .select(
          'id, title, vendor_profile_id, price_cad, available_slots, duration_minutes, location, booking_status, date, workshop_series, series_occurrences'
        )
        .eq('id', String(event_id))
        .single()

      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }

      // Check if it's a SaaS vendor event
      if (!event.vendor_profile_id) {
        // Legacy event — fall through to old redirect behavior
        return handleLegacyBook(raw, user)
      }

      if (event.booking_status === 'fully_booked') {
        return NextResponse.json({ error: 'This session is fully booked' }, { status: 409 })
      }

      if (event.booking_status !== 'published') {
        return NextResponse.json({ error: 'This session is not available for booking' }, { status: 409 })
      }

      if ((event.available_slots ?? 0) <= 0) {
        return NextResponse.json({ error: 'No spots remaining' }, { status: 409 })
      }

      const dry = computeSlotDecrementForEvent(event, start_time, undefined)
      if (!dry.ok) {
        return NextResponse.json({ error: dry.error }, { status: 409 })
      }

      const { data: vendor } = await admin
        .from('vendor_profiles')
        .select('stripe_account_id, business_name, location_address')
        .eq('id', event.vendor_profile_id)
        .single()

      if (!vendor?.stripe_account_id) {
        return NextResponse.json({ error: 'Vendor payout account not set up yet' }, { status: 422 })
      }

      const priceCad = (event.price_cad ?? 0) as number

      // Free sessions — no payment needed
      if (priceCad === 0) {
        return NextResponse.json({ free: true, message: 'Free session — confirm on the next step' })
      }

      let stripeCustomerId: string | undefined
      if (user?.id && user.email) {
        try {
          stripeCustomerId = await getOrCreateStripeCustomerId(admin, stripe, user.id, user.email)
        } catch (e) {
          console.error('Stripe customer for consumer:', e)
          return NextResponse.json(
            { error: 'Could not start checkout. Please try again.' },
            { status: 500 }
          )
        }
      }

      let profilePostal: string | null = null
      if (user?.id) {
        const { data: profile } = await admin
          .from('profiles')
          .select('postal_code')
          .eq('id', user.id)
          .maybeSingle()
        profilePostal = profile?.postal_code?.trim() ?? null
      }

      const customerTaxAddr = resolveWorkshopCustomerTaxAddress({
        customerAddress: customer_address,
        profilePostalCode: profilePostal,
        eventLocation: (event.location as string | null) ?? null,
      })

      if (!customerTaxAddr) {
        return NextResponse.json(
          {
            error:
              'Add a Canadian postal code in your profile to book (Settings → location), or book a workshop with a Canadian address on the listing.',
          },
          { status: 422 }
        )
      }

      let taxBreakdown
      try {
        taxBreakdown = await calculateWorkshopTicketTax(stripe, {
          connectedAccountId: vendor.stripe_account_id,
          subtotalCad: priceCad,
          customerAddress: customerTaxAddr,
          reference: `event_${event.id}`,
          vendorLocationAddress: vendor.location_address,
        })
      } catch (taxErr) {
        console.error('Stripe Tax calculation error:', taxErr)
        const detail =
          taxErr instanceof Stripe.errors.StripeError
            ? taxErr.message
            : taxErr instanceof Error
              ? taxErr.message
              : undefined
        return NextResponse.json(
          {
            error:
              detail ??
              'Could not calculate tax for this workshop. The vendor may need to complete tax setup in Stripe.',
          },
          { status: 422 }
        )
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: taxBreakdown.amountTotalCents,
        currency: 'cad',
        payment_method_types: ['card'],
        transfer_data: {
          destination: vendor.stripe_account_id,
        },
        ...(stripeCustomerId
          ? {
              customer: stripeCustomerId,
              setup_future_usage: 'off_session' as const,
            }
          : {}),
        metadata: {
          event_id: String(event.id),
          vendor_id: event.vendor_profile_id,
          attendee_name,
          attendee_email,
          start_time: start_time ?? (event.date ? String(event.date) : ''),
          price_cad: String(priceCad),
          subtotal_cad: String(taxBreakdown.subtotalCad),
          tax_cad: String(taxBreakdown.taxCad),
          total_cad: String(taxBreakdown.totalCad),
          tax_calculation: taxBreakdown.calculationId,
          stripe_account_id: vendor.stripe_account_id,
          ...(user?.id ? { app_user_id: user.id } : {}),
        },
        description: `${vendor.business_name} — ${event.title}`,
        receipt_email: attendee_email,
      })

      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: taxBreakdown.totalCad,
        subtotalCad: taxBreakdown.subtotalCad,
        taxCad: taxBreakdown.taxCad,
        totalCad: taxBreakdown.totalCad,
      })
    }

    // Legacy booking schema fallback (for existing app)
    const legacyParsed = bookBodySchema.safeParse(raw)
    if (!legacyParsed.success) {
      const msg = legacyParsed.error.flatten().formErrors[0] ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    return handleLegacyBook(raw, user)
  } catch (error) {
    console.error('Book API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function handleLegacyBook(raw: Record<string, unknown>, user: { id: string } | null) {
  const { createClient: createSupabase } = await import('@/lib/supabase/server')
  const supabase = await createSupabase()

  const event_id = raw.event_id as string | number

  await supabase.from('event_redirects').insert({
    event_id,
    user_id: user?.id ?? null,
  }).then(() => {}) // ignore errors

  if (!user) {
    return NextResponse.json({ success: true })
  }

  await supabase.from('bookings').upsert(
    {
      user_id: user.id,
      event_id,
      status: 'booked',
    },
    { onConflict: 'user_id,event_id' }
  )

  return NextResponse.json({ success: true })
}


