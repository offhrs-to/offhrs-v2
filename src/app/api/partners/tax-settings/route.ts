import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureConnectedAccountStripeTaxReady } from '@/lib/stripe-vendor-tax-setup'
import {
  formatGstHstRegistrationNumberForDisplay,
  validateVendorGstHstAttestation,
} from '@/lib/vendor-gst-hst'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

const taxSettingsSchema = z.object({
  gst_hst_registered: z.boolean(),
  gst_hst_registration_number: z.string().max(32).optional().or(z.literal('')),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const { data: vendor, error } = await admin
      .from('vendor_profiles')
      .select(
        'gst_hst_registered, gst_hst_registration_number, gst_hst_settings_confirmed_at, stripe_account_id, location_address'
      )
      .eq('user_id', user.id)
      .single()

    if (error || !vendor) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    }

    return NextResponse.json({
      gst_hst_registered: vendor.gst_hst_registered === true,
      gst_hst_registration_number: formatGstHstRegistrationNumberForDisplay(
        vendor.gst_hst_registration_number
      ),
      gst_hst_settings_confirmed: vendor.gst_hst_settings_confirmed_at != null,
      stripe_account_id: vendor.stripe_account_id ?? null,
    })
  } catch (err) {
    console.error('Tax settings GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const parsed = taxSettingsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const validated = validateVendorGstHstAttestation(
      parsed.data.gst_hst_registered,
      parsed.data.gst_hst_registration_number
    )
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const { data: vendor, error: fetchError } = await admin
      .from('vendor_profiles')
      .select('id, stripe_account_id, location_address')
      .eq('user_id', user.id)
      .single()

    if (fetchError || !vendor) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    }

    const { error: updateError } = await admin
      .from('vendor_profiles')
      .update({
        gst_hst_registered: parsed.data.gst_hst_registered,
        gst_hst_registration_number: validated.registrationNumber,
        gst_hst_settings_confirmed_at: new Date().toISOString(),
      })
      .eq('id', vendor.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (vendor.stripe_account_id) {
      try {
        await ensureConnectedAccountStripeTaxReady(stripe, vendor.stripe_account_id, {
          locationAddress: vendor.location_address,
          gstHstRegistered: parsed.data.gst_hst_registered,
        })
      } catch (taxErr) {
        console.warn('Tax settings Stripe sync failed:', taxErr)
        return NextResponse.json(
          {
            success: true,
            warning:
              'Tax settings saved, but Stripe Tax could not be updated. Try again or contact support.',
          },
          { status: 200 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      gst_hst_registered: parsed.data.gst_hst_registered,
      gst_hst_registration_number: formatGstHstRegistrationNumberForDisplay(
        validated.registrationNumber
      ),
    })
  } catch (err) {
    console.error('Tax settings PUT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
