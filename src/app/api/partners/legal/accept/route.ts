import {
  clientIpFromRequest,
  CURRENT_POLICY_VERSION,
  recordPartnerClickwrapAcceptances,
  userAgentFromRequest,
  vendorHasCurrentPartnerTermsAcceptance,
} from '@/lib/legal-acceptances'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const bodySchema = z.object({
  accepted: z.literal(true),
  context: z.enum(['partner_reaccept', 'shopify_connect']).default('partner_reaccept'),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'You must accept the current Terms to continue.' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!vendor) {
      return NextResponse.json({ error: 'Partner account required.' }, { status: 403 })
    }

    const alreadyAccepted = await vendorHasCurrentPartnerTermsAcceptance(admin, user.id)
    // Re-accept gate: skip duplicate inserts. Shopify Connect always logs click assent.
    if (alreadyAccepted && parsed.data.context === 'partner_reaccept') {
      return NextResponse.json({
        success: true,
        already_accepted: true,
        version: CURRENT_POLICY_VERSION,
      })
    }

    const recorded = await recordPartnerClickwrapAcceptances({
      admin,
      userId: user.id,
      vendorId: vendor.id,
      context: parsed.data.context,
      ipAddress: clientIpFromRequest(request),
      userAgent: userAgentFromRequest(request),
    })
    if (!recorded.ok) {
      return NextResponse.json(
        { error: 'Could not record Terms acceptance. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      version: CURRENT_POLICY_VERSION,
      already_accepted: alreadyAccepted,
    })
  } catch (err) {
    console.error('partners legal accept POST', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const accepted = await vendorHasCurrentPartnerTermsAcceptance(admin, user.id)
    return NextResponse.json({
      accepted,
      version: CURRENT_POLICY_VERSION,
    })
  } catch (err) {
    console.error('partners legal accept GET', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
