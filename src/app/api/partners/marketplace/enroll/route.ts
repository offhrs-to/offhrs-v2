import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { vendorHasNativePartnerPlan } from '@/lib/partner-access'

/**
 * POST /api/partners/marketplace/enroll
 * Enable Marketplace-free for Sync-only or pending vendors (no Lite/Pro required).
 * Lite/Pro already have included access via ensureMarketplaceIncludedFlags.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id, status, marketplace_enabled, email_verified')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    if (!vendor.email_verified) {
      return NextResponse.json({ error: 'Verify your email before enabling Marketplace.' }, { status: 400 })
    }

    const hasNative = await vendorHasNativePartnerPlan(admin, vendor.id)
    const now = new Date().toISOString()
    const patch: Record<string, unknown> = {
      marketplace_enabled: true,
      marketplace_plan: hasNative ? 'included' : 'free',
      marketplace_qa_status: 'pending_review',
      updated_at: now,
    }
    if (!vendor.marketplace_enabled) patch.marketplace_enrolled_at = now

    // Marketplace-free unlocks dashboard without Stripe Lite/Pro checkout.
    if (!hasNative && vendor.status === 'pending') {
      patch.status = 'active'
    }

    const { error } = await admin.from('vendor_profiles').update(patch).eq('id', vendor.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      marketplace_plan: hasNative ? 'included' : 'free',
    })
  } catch (err) {
    console.error('marketplace enroll', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
