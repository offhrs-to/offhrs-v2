import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { logSecurityEvent } from '@/lib/security-monitor'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder', {
  apiVersion: '2026-04-22.dahlia',
})

/**
 * POST /api/partners/account/delete
 *
 * Deletes the vendor (partner) account for the authenticated user:
 *   - cancels any active Stripe subscription immediately
 *   - deletes vendor_profiles row (FK cascade clears events, vendor_subscriptions,
 *     vendor_payouts, vendor_calendar_connections, vendor_reviews(vendor_profile_id),
 *     and events.bookings)
 *
 * If the same auth user also has a consumer `profiles` row, the auth.users row
 * is kept so the consumer login (mobile app) keeps working. Otherwise the auth
 * user is deleted too.
 */
export async function POST(request: NextRequest) {
  try {
    const baseKey = getRateLimitKey(request)
    const globalRl = consumeRateLimit(`partner-account-delete:${baseKey}`, 5)
    if (!globalRl.allowed) {
      logSecurityEvent('warn', {
        type: 'rate_limited',
        route: '/api/partners/account/delete',
        ipKey: baseKey,
      })
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(globalRl.retryAfterSeconds) } }
      )
    }

    const bearerToken = request.headers.get('authorization')?.startsWith('Bearer ')
      ? request.headers.get('authorization')!.slice(7).trim()
      : null

    const supabase = await createClient()
    let user = (await supabase.auth.getUser()).data.user

    if (!user && bearerToken) {
      const bearerClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
      )
      user = (await bearerClient.auth.getUser()).data.user ?? null
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRl = consumeRateLimit(`partner-account-delete-user:${user.id}`, 3)
    if (!userRl.allowed) {
      logSecurityEvent('warn', {
        type: 'rate_limited',
        route: '/api/partners/account/delete',
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(userRl.retryAfterSeconds) } }
      )
    }

    const admin = createAdminClient()
    if (!admin) {
      console.error('Partner account delete: admin client unavailable')
      return NextResponse.json(
        { error: 'Account deletion is not available', stage: 'admin_client' },
        { status: 503 }
      )
    }

    const userId = user.id

    const { data: vendor, error: vendorErr } = await admin
      .from('vendor_profiles')
      .select('id, stripe_customer_id, stripe_account_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (vendorErr) {
      console.error('Partner account delete: vendor lookup', vendorErr.message, userId)
      return NextResponse.json(
        { error: `Failed to look up vendor profile: ${vendorErr.message}`, stage: 'vendor_lookup' },
        { status: 500 }
      )
    }

    if (!vendor) {
      return NextResponse.json(
        { error: 'No vendor account found for this user.', stage: 'not_found' },
        { status: 404 }
      )
    }

    // 1. Cancel any active Stripe subscriptions so we stop billing the vendor.
    const { data: subs } = await admin
      .from('vendor_subscriptions')
      .select('stripe_subscription_id, status')
      .eq('vendor_id', vendor.id)

    for (const s of subs ?? []) {
      const subId = (s as { stripe_subscription_id?: string | null }).stripe_subscription_id
      const status = (s as { status?: string | null }).status
      if (!subId) continue
      if (status === 'canceled' || status === 'incomplete_expired') continue
      try {
        await stripe.subscriptions.cancel(subId, { prorate: false })
      } catch (e) {
        const code = e instanceof Stripe.errors.StripeError ? e.code : undefined
        if (code === 'resource_missing') {
          // Subscription already gone in Stripe — ignore.
          continue
        }
        console.error('Partner account delete: Stripe subscription cancel failed', subId, e)
        // Continue with deletion anyway; the vendor will not be re-billed once
        // the customer/sub records are detached from offhrs.
      }
    }

    // 2. Delete vendor_profiles. FK cascade rules wipe:
    //      vendor_subscriptions, vendor_payouts, vendor_calendar_connections,
    //      vendor_reviews(vendor_profile_id), events(vendor_profile_id),
    //      bookings(event_id cascade)
    const { error: deleteErr } = await admin
      .from('vendor_profiles')
      .delete()
      .eq('id', vendor.id)

    if (deleteErr) {
      console.error('Partner account delete: vendor_profiles delete failed', deleteErr.message, userId)
      return NextResponse.json(
        { error: `Failed to delete vendor profile: ${deleteErr.message}`, stage: 'vendor_profiles' },
        { status: 500 }
      )
    }

    // 3. Decide whether to also delete the auth user.
    //
    //    The `on_auth_user_created` trigger auto-creates a `profiles` row for
    //    every signup, so a profiles row alone does NOT prove the email was
    //    used as a consumer. To preserve auth.users only when there is real
    //    consumer activity, look for bookings / saves / reviews / completed
    //    consumer onboarding tied to this auth user.
    let hasConsumerActivity = false

    const consumerChecks = await Promise.all([
      admin.from('bookings').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      admin.from('user_event_saves').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      admin.from('vendor_reviews').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      admin
        .from('profiles')
        .select('onboarding_completed, category_of_interest')
        .eq('id', userId)
        .maybeSingle(),
    ])

    for (const r of consumerChecks.slice(0, 3) as Array<{ count: number | null }>) {
      if ((r.count ?? 0) > 0) {
        hasConsumerActivity = true
        break
      }
    }

    if (!hasConsumerActivity) {
      const profileRow = (consumerChecks[3] as { data?: { onboarding_completed?: boolean | null; category_of_interest?: string[] | null } | null }).data
      if (
        profileRow?.onboarding_completed === true ||
        (Array.isArray(profileRow?.category_of_interest) && profileRow!.category_of_interest!.length > 0)
      ) {
        hasConsumerActivity = true
      }
    }

    const preservedConsumerAccount = hasConsumerActivity

    if (!preservedConsumerAccount) {
      // Deleting auth.users cascades to public.profiles via the FK
      // `profiles.id REFERENCES auth.users(id) ON DELETE CASCADE`, freeing the
      // email for a fresh signup.
      const { error: authErr } = await admin.auth.admin.deleteUser(userId)
      if (authErr) {
        console.error('Partner account delete: auth deleteUser failed', authErr.message, userId)
        return NextResponse.json(
          { error: `Failed to delete auth user: ${authErr.message}`, stage: 'auth_user' },
          { status: 500 }
        )
      }
    }

    logSecurityEvent('info', {
      type: 'partner_account_deleted',
      userId,
      details: {
        vendorId: vendor.id,
        preservedConsumerAccount,
      },
    })

    return NextResponse.json({ success: true, preservedConsumerAccount })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Partner account delete error:', message, err)
    return NextResponse.json({ error: `Internal error: ${message}`, stage: 'exception' }, { status: 500 })
  }
}
