import { bookBodySchema } from '@/lib/api-validation'
import { logSecurityEvent } from '@/lib/security-monitor'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { consumeDailyQuota } from '@/lib/daily-quota'
import { isKillSwitchActive, killSwitchResponse } from '@/lib/kill-switch'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { computeSlotDecrementForEvent } from '@/lib/workshop-series'
import { getOrCreateStripeCustomerId } from '@/lib/stripe-consumer-customer'
import {
  calculateWorkshopTicketTax,
  resolveWorkshopCustomerTaxAddress,
} from '@/lib/stripe-workshop-tax'
import { estimateCanadianStripeFee } from '@/lib/stripe-charge-fees'
import { workshopBookingBlockReason } from '@/lib/workshop-registration-closed'
import { effectiveWorkshopPriceCad } from '@/lib/workshop-ticket-price'
import { eventFieldsForOccurrenceStart } from '@/lib/workshop-series'

const BOOK_RATE_LIMIT = 15 // per minute per IP
const BOOK_DAILY_LIMIT = 100 // per day per IP(+user)

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
  if (isKillSwitchActive()) return killSwitchResponse('/api/book')

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

    const daily = await consumeDailyQuota(`book:${key}`, BOOK_DAILY_LIMIT)
    if (!daily.allowed) {
      logSecurityEvent('warn', { type: 'daily_quota_exceeded', route: '/api/book', ipKey: key })
      return NextResponse.json(
        { error: 'Daily limit reached. Please try again tomorrow.' },
        { status: 429 }
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
          'id, title, vendor_profile_id, listing_source, shopify_product_id, external_link, price_cad, sale_price_cad, sale_starts_on, sale_ends_on, available_slots, duration_minutes, location, booking_status, registration_closed, date, workshop_series, series_occurrences, partner_series_meta'
        )
        .eq('id', String(event_id))
        .single()

      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }

      // Shopify-mirrored listings book on the vendor storefront, not Stripe.
      if (
        event.listing_source === 'shopify' ||
        (event.shopify_product_id != null && String(event.shopify_product_id).length > 0)
      ) {
        return handleLegacyBook(raw, user)
      }

      // Check if it's a SaaS vendor event
      if (!event.vendor_profile_id) {
        // Legacy event — fall through to old redirect behavior
        return handleLegacyBook(raw, user)
      }

      const bookingBlock = workshopBookingBlockReason(event, start_time)
      if (bookingBlock) {
        return NextResponse.json({ error: bookingBlock }, { status: 409 })
      }

      const dry = computeSlotDecrementForEvent(event, start_time, undefined)
      if (!dry.ok) {
        return NextResponse.json({ error: dry.error }, { status: 409 })
      }

      const { data: vendor } = await admin
        .from('vendor_profiles')
        .select(
          'stripe_account_id, business_name, location_address, gst_hst_registered, gst_hst_registration_number'
        )
        .eq('id', event.vendor_profile_id)
        .single()

      if (!vendor?.stripe_account_id) {
        return NextResponse.json({ error: 'Vendor payout account not set up yet' }, { status: 422 })
      }

      const pricing = eventFieldsForOccurrenceStart(event, start_time)
      const priceCad = effectiveWorkshopPriceCad(pricing)

      // Free sessions — no payment needed
      if (priceCad === 0) {
        return NextResponse.json({ free: true, message: 'Free session — confirm on the next step' })
      }

      if (!user?.id) {
        return NextResponse.json(
          { error: 'Sign in required to book and pay in the app.' },
          { status: 401 }
        )
      }

      let stripeCustomerId: string | undefined
      if (user.email) {
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

      const collectsGstHst = vendor.gst_hst_registered === true

      let profilePostal: string | null = null
      if (user?.id) {
        const { data: profile } = await admin
          .from('profiles')
          .select('postal_code')
          .eq('id', user.id)
          .maybeSingle()
        profilePostal = profile?.postal_code?.trim() ?? null
      }

      const customerTaxAddr = collectsGstHst
        ? resolveWorkshopCustomerTaxAddress({
            customerAddress: customer_address,
            profilePostalCode: profilePostal,
            eventLocation: (pricing.location as string | null) ?? null,
          })
        : null

      if (collectsGstHst && !customerTaxAddr) {
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
          customerAddress: customerTaxAddr ?? {
            country: 'CA',
            postal_code: 'M5H 2N2',
            state: 'ON',
          },
          reference: `event_${event.id}`,
          vendorLocationAddress: vendor.location_address,
          gstHstRegistered: collectsGstHst,
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

      const estimatedStripeFeeCents = Math.min(
        taxBreakdown.amountTotalCents,
        Math.max(0, Math.round(estimateCanadianStripeFee(taxBreakdown.totalCad).feeCad * 100))
      )

      let applicationFeeAmount: number | undefined
      try {
        const connectedAccount = await stripe.accounts.retrieve(vendor.stripe_account_id)
        const feePayer = connectedAccount.controller?.fees?.payer
        if (feePayer !== 'account' && estimatedStripeFeeCents > 0) {
          applicationFeeAmount = estimatedStripeFeeCents
        }
      } catch (accountErr) {
        console.warn(
          'Could not inspect connected account fee payer; applying fee recoup fallback',
          vendor.stripe_account_id,
          accountErr instanceof Error ? accountErr.message : accountErr
        )
        if (estimatedStripeFeeCents > 0) {
          applicationFeeAmount = estimatedStripeFeeCents
        }
      }

      // Destination charge with `on_behalf_of` set to the connected (vendor) account.
      //
      // This makes the vendor's connected account the *settlement merchant*, which means:
      //   1. Pricing/interchange follows the connected account's country (CA Express).
      //   2. The vendor's statement descriptor appears on the cardholder's statement.
      //
      // Express accounts require `controller.fees.payer = application` (platform is the
      // fee payer). We set application_fee_amount to the estimated Stripe processing fee
      // so that amount stays with the platform and the vendor's transfer is net of card
      // fees. On refund we keep that application fee (see booking-refund.ts) so vendors
      // still absorb processing after a customer refund.
      //
      // Docs: https://docs.stripe.com/connect/destination-charges#settlement-merchant
      const paymentIntent = await stripe.paymentIntents.create({
        amount: taxBreakdown.amountTotalCents,
        currency: 'cad',
        // Let PaymentSheet surface eligible card wallets (Apple Pay / Google Pay)
        // from the account's payment method settings. Hard-pinning only `card`
        // can prevent wallet availability checks from matching Stripe's current
        // mobile PaymentSheet flow.
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        on_behalf_of: vendor.stripe_account_id,
        ...(applicationFeeAmount ? { application_fee_amount: applicationFeeAmount } : {}),
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
          application_fee_cents: String(applicationFeeAmount ?? 0),
          estimated_stripe_fee_cents: String(estimatedStripeFeeCents),
          stripe_account_id: vendor.stripe_account_id,
          app_user_id: user.id,
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


