import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('stripe_account_id, stripe_connect_completed')
    .eq('user_id', user.id)
    .single()

  if (!vendor?.stripe_account_id) {
    return NextResponse.json({ error: 'Stripe Connect not set up' }, { status: 400 })
  }

  const loginLink = await stripe.accounts.createLoginLink(vendor.stripe_account_id)
  return NextResponse.json({ url: loginLink.url })
}
