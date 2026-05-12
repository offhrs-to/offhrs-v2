import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/** GET — client polls during partner onboarding billing step (session + vendor flags). */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        email_verified: false,
        vendor_status: null as string | null,
        stripe_checkout_completed: false,
      })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('email_verified, status, stripe_checkout_completed')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      authenticated: true,
      email_verified: Boolean(vendor?.email_verified),
      vendor_status: (vendor?.status as string | null) ?? null,
      stripe_checkout_completed: Boolean(vendor?.stripe_checkout_completed),
    })
  } catch (err) {
    console.error('[onboarding-billing-status]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
