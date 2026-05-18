/**
 * POST /api/book/quote — Stripe Tax preview for a workshop (no PaymentIntent).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resolveCustomerTaxAddress, calculateWorkshopTicketTax } from '@/lib/stripe-workshop-tax'
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
      .select('id, vendor_profile_id, price_cad, booking_status')
      .eq('id', String(parsed.data.event_id))
      .single()

    if (!event?.vendor_profile_id) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const priceCad = Number(event.price_cad ?? 0)
    if (priceCad <= 0) {
      return NextResponse.json({
        free: true,
        subtotalCad: 0,
        taxCad: 0,
        totalCad: 0,
      })
    }

    let customerAddress = parsed.data.customer_address
      ? resolveCustomerTaxAddress(parsed.data.customer_address)
      : null

    if (!customerAddress && user?.id) {
      const { data: profile } = await admin
        .from('profiles')
        .select('postal_code')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.postal_code) {
        customerAddress = resolveCustomerTaxAddress({ postal_code: profile.postal_code })
      }
    }

    if (!customerAddress) {
      return NextResponse.json(
        {
          error:
            'Add a Canadian postal code in your profile (or pass customer_address) to calculate tax.',
        },
        { status: 422 }
      )
    }

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('stripe_account_id')
      .eq('id', event.vendor_profile_id)
      .single()

    if (!vendor?.stripe_account_id) {
      return NextResponse.json({ error: 'Vendor payout account not set up yet' }, { status: 422 })
    }

    const tax = await calculateWorkshopTicketTax(stripe, {
      connectedAccountId: vendor.stripe_account_id,
      subtotalCad: priceCad,
      customerAddress,
      reference: `event_${event.id}`,
    })

    return NextResponse.json({
      subtotalCad: tax.subtotalCad,
      taxCad: tax.taxCad,
      totalCad: tax.totalCad,
    })
  } catch (err) {
    console.error('Book quote error:', err)
    const msg = err instanceof Error ? err.message : 'Could not calculate tax'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
