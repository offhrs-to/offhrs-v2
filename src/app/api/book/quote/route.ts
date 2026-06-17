/**
 * POST /api/book/quote — Stripe Tax preview for a workshop (no PaymentIntent).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRefundWindowHours } from '@/lib/booking-refund'
import {
  buildWorkshopPriceBreakdownNoTax,
  calculateWorkshopTicketTax,
  resolveWorkshopCustomerTaxAddress,
} from '@/lib/stripe-workshop-tax'
import {
  getCachedTaxQuote,
  setCachedTaxQuote,
} from '@/lib/workshop-tax-quote-cache'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

const quoteSchema = z.object({
  event_id: z.union([z.string(), z.number()]),
  customer_address: z
    .object({
      country: z.string().optional(),
      postal_code: z.string().min(3).max(12),
      state: z.string().max(3).optional(),
      city: z.string().max(120).optional(),
      line1: z.string().max(200).optional(),
    })
    .optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
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
    }

    const parsed = quoteSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

    const { data: event } = await admin
      .from('events')
      .select('id, vendor_profile_id, price_cad, booking_status, location')
      .eq('id', String(parsed.data.event_id))
      .single()

    if (!event?.vendor_profile_id) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select(
        'stripe_account_id, location_address, refund_window_hours, gst_hst_registered, gst_hst_registration_number'
      )
      .eq('id', event.vendor_profile_id)
      .single()

    const refundWindowHours = getEffectiveRefundWindowHours(
      (vendor?.refund_window_hours as number | null) ?? 48
    )
    const refundPolicyLine = `Free cancellation with full refund up to ${refundWindowHours} hours before the session starts.`

    const priceCad = Number(event.price_cad ?? 0)

    if (priceCad <= 0) {
      return NextResponse.json({
        free: true,
        subtotalCad: 0,
        taxCad: 0,
        totalCad: 0,
        refundWindowHours,
        refundPolicyLine,
      })
    }

    const collectsGstHst = vendor?.gst_hst_registered === true

    let profilePostal: string | null = null
    if (user?.id) {
      const { data: profile } = await admin
        .from('profiles')
        .select('postal_code')
        .eq('id', user.id)
        .maybeSingle()
      profilePostal = profile?.postal_code?.trim() ?? null
    }

    const customerAddress = collectsGstHst
      ? resolveWorkshopCustomerTaxAddress({
          customerAddress: parsed.data.customer_address,
          profilePostalCode: profilePostal,
          eventLocation: (event.location as string | null) ?? null,
        })
      : null

    if (collectsGstHst && !customerAddress) {
      return NextResponse.json(
        {
          error:
            'Add a Canadian postal code in your profile, or use a workshop with a Canadian address, to calculate tax.',
        },
        { status: 422 }
      )
    }

    if (!vendor?.stripe_account_id) {
      return NextResponse.json({ error: 'Vendor payout account not set up yet' }, { status: 422 })
    }

    if (!collectsGstHst) {
      const noTax = buildWorkshopPriceBreakdownNoTax(priceCad)
      return NextResponse.json({
        subtotalCad: noTax.subtotalCad,
        taxCad: noTax.taxCad,
        totalCad: noTax.totalCad,
        collectsGstHst: false,
        refundWindowHours,
        refundPolicyLine,
      })
    }

    // Repeat quick-view opens of the same workshop produce identical Stripe
    // Tax results but each one costs the platform ~$0.05 in Tax API fees.
    // Serve a cached preview when the same (event, postal, province) was
    // priced in the last 10 minutes on this server instance. Booking the
    // workshop still creates a fresh calculation (handled in /api/book) so
    // every PaymentIntent gets its own Stripe Tax transaction.
    if (!customerAddress) {
      return NextResponse.json({ error: 'Canadian address required for tax' }, { status: 422 })
    }

    const cached = getCachedTaxQuote(event.id, customerAddress.postal_code, customerAddress.state)
    if (cached) {
      return NextResponse.json({
        subtotalCad: cached.subtotalCad,
        taxCad: cached.taxCad,
        totalCad: cached.totalCad,
        refundWindowHours: cached.refundWindowHours,
        refundPolicyLine: cached.refundPolicyLine,
      })
    }

    const tax = await calculateWorkshopTicketTax(stripe, {
      connectedAccountId: vendor.stripe_account_id,
      subtotalCad: priceCad,
      customerAddress,
      reference: `event_${event.id}`,
      vendorLocationAddress: vendor.location_address,
      gstHstRegistered: true,
    })

    setCachedTaxQuote(event.id, customerAddress.postal_code, customerAddress.state, {
      subtotalCad: tax.subtotalCad,
      taxCad: tax.taxCad,
      totalCad: tax.totalCad,
      refundWindowHours,
      refundPolicyLine,
    })

    return NextResponse.json({
      subtotalCad: tax.subtotalCad,
      taxCad: tax.taxCad,
      totalCad: tax.totalCad,
      collectsGstHst: true,
      refundWindowHours,
      refundPolicyLine,
    })
  } catch (err) {
    console.error('Book quote error:', err)
    const msg =
      err instanceof Stripe.errors.StripeError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Could not calculate tax'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
