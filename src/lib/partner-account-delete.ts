import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { processBookingRefund } from '@/lib/booking-refund'
import { logSecurityEvent } from '@/lib/security-monitor'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder', {
  apiVersion: '2026-04-22.dahlia',
})

const ACTIVE_BOOKING_STATUSES = new Set([
  'confirmed',
  'pending',
  'booked',
  'pending_confirmation',
])

export type DeletePartnerVendorResult =
  | { ok: true; preservedConsumerAccount: boolean; vendorId: string; userId: string }
  | { ok: false; status: number; error: string; stage: string; details?: unknown }

/**
 * Cancel Stripe billing, clear bookings, delete vendor_profiles (+ cascades),
 * and delete auth user when there is no consumer activity.
 */
export async function deletePartnerVendorById(
  admin: SupabaseClient,
  vendorId: string,
  opts?: { initiatedBy?: 'self' | 'admin' }
): Promise<DeletePartnerVendorResult> {
  const initiatedBy = opts?.initiatedBy ?? 'self'

  const { data: vendor, error: vendorErr } = await admin
    .from('vendor_profiles')
    .select('id, user_id, stripe_customer_id, stripe_account_id, business_name, slug')
    .eq('id', vendorId)
    .maybeSingle()

  if (vendorErr) {
    return {
      ok: false,
      status: 500,
      error: `Failed to look up vendor profile: ${vendorErr.message}`,
      stage: 'vendor_lookup',
    }
  }
  if (!vendor?.user_id) {
    return { ok: false, status: 404, error: 'Vendor not found', stage: 'not_found' }
  }

  const userId = vendor.user_id as string

  // Block hard-delete if Marketplace orders still exist (FK / history).
  const { count: shopOrderCount } = await admin
    .from('shop_orders')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', vendorId)
  if ((shopOrderCount ?? 0) > 0) {
    return {
      ok: false,
      status: 409,
      error:
        'This vendor has Marketplace orders. Suspend them instead of deleting, or clear/refund orders first.',
      stage: 'shop_orders_exist',
      details: { shopOrderCount },
    }
  }

  // Archive/unpublish shop products so they don't linger if FK blocks delete.
  await admin
    .from('shop_products')
    .update({ status: 'archived' })
    .eq('vendor_id', vendorId)

  const { data: subs } = await admin
    .from('vendor_subscriptions')
    .select('stripe_subscription_id, status')
    .eq('vendor_id', vendorId)

  for (const s of subs ?? []) {
    const subId = (s as { stripe_subscription_id?: string | null }).stripe_subscription_id
    const status = (s as { status?: string | null }).status
    if (!subId) continue
    if (status === 'canceled' || status === 'incomplete_expired') continue
    try {
      await stripe.subscriptions.cancel(subId, { prorate: false })
    } catch (e) {
      const code = e instanceof Stripe.errors.StripeError ? e.code : undefined
      if (code === 'resource_missing') continue
      console.error('Partner delete: Stripe subscription cancel failed', subId, e)
    }
  }

  const { data: vendorBookings, error: bookingsLookupErr } = await admin
    .from('bookings')
    .select('id, status, refunded_at, stripe_payment_intent_id')
    .eq('vendor_id', vendorId)

  if (bookingsLookupErr) {
    return {
      ok: false,
      status: 500,
      error: `Failed to look up vendor bookings: ${bookingsLookupErr.message}`,
      stage: 'bookings_lookup',
    }
  }

  const refundFailures: { bookingId: string; error: string }[] = []
  for (const b of vendorBookings ?? []) {
    const status = ((b as { status?: string | null }).status ?? '').toLowerCase()
    const refundedAt = (b as { refunded_at?: string | null }).refunded_at ?? null
    const piId = (b as { stripe_payment_intent_id?: string | null }).stripe_payment_intent_id
    const isActivePaid = ACTIVE_BOOKING_STATUSES.has(status) && !refundedAt && Boolean(piId)
    if (!isActivePaid) continue

    const result = await processBookingRefund(admin, b.id as string, {
      initiatedBy: 'vendor',
      cancellationReason:
        initiatedBy === 'admin' ? 'Vendor account removed by offhrs' : 'Vendor account deleted',
      skipRefundWindowCheck: true,
    })
    if (!result.ok) {
      refundFailures.push({ bookingId: b.id as string, error: result.error })
    }
  }

  if (refundFailures.length > 0) {
    return {
      ok: false,
      status: 500,
      error:
        'Could not refund all active bookings before deleting the account. Resolve refunds in Stripe and retry.',
      stage: 'refund_active_bookings',
      details: refundFailures,
    }
  }

  if ((vendorBookings ?? []).length > 0) {
    const { error: bookingsDeleteErr } = await admin.from('bookings').delete().eq('vendor_id', vendorId)
    if (bookingsDeleteErr) {
      return {
        ok: false,
        status: 500,
        error: `Failed to clear vendor bookings: ${bookingsDeleteErr.message}`,
        stage: 'bookings_delete',
      }
    }
  }

  // Drop product rows (0 orders checked above).
  await admin.from('shop_products').delete().eq('vendor_id', vendorId)

  const { error: deleteErr } = await admin.from('vendor_profiles').delete().eq('id', vendorId)
  if (deleteErr) {
    return {
      ok: false,
      status: 500,
      error: `Failed to delete vendor profile: ${deleteErr.message}`,
      stage: 'vendor_profiles',
    }
  }

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
    const profileRow = (
      consumerChecks[3] as {
        data?: { onboarding_completed?: boolean | null; category_of_interest?: string[] | null } | null
      }
    ).data
    if (
      profileRow?.onboarding_completed === true ||
      (Array.isArray(profileRow?.category_of_interest) && profileRow!.category_of_interest!.length > 0)
    ) {
      hasConsumerActivity = true
    }
  }

  const preservedConsumerAccount = hasConsumerActivity
  if (!preservedConsumerAccount) {
    const { error: authErr } = await admin.auth.admin.deleteUser(userId)
    if (authErr) {
      return {
        ok: false,
        status: 500,
        error: `Failed to delete auth user: ${authErr.message}`,
        stage: 'auth_user',
      }
    }
  }

  logSecurityEvent('info', {
    type: 'partner_account_deleted',
    userId,
    details: {
      vendorId,
      initiatedBy,
      businessName: vendor.business_name,
      slug: vendor.slug,
      preservedConsumerAccount,
    },
  })

  return { ok: true, preservedConsumerAccount, vendorId, userId }
}

/** Soft-disable: stop Marketplace + mark canceled; cancel Stripe sub. Keeps row for audit. */
export async function suspendPartnerVendorById(
  admin: SupabaseClient,
  vendorId: string
): Promise<DeletePartnerVendorResult> {
  const { data: vendor, error } = await admin
    .from('vendor_profiles')
    .select('id, user_id')
    .eq('id', vendorId)
    .maybeSingle()
  if (error) {
    return { ok: false, status: 500, error: error.message, stage: 'vendor_lookup' }
  }
  if (!vendor) {
    return { ok: false, status: 404, error: 'Vendor not found', stage: 'not_found' }
  }

  const { data: subs } = await admin
    .from('vendor_subscriptions')
    .select('stripe_subscription_id, status')
    .eq('vendor_id', vendorId)

  for (const s of subs ?? []) {
    const subId = (s as { stripe_subscription_id?: string | null }).stripe_subscription_id
    const status = (s as { status?: string | null }).status
    if (!subId || status === 'canceled' || status === 'incomplete_expired') continue
    try {
      await stripe.subscriptions.cancel(subId, { prorate: false })
    } catch (e) {
      const code = e instanceof Stripe.errors.StripeError ? e.code : undefined
      if (code !== 'resource_missing') {
        console.error('suspendPartnerVendor: cancel sub failed', subId, e)
      }
    }
  }

  await admin
    .from('vendor_subscriptions')
    .update({ status: 'canceled' })
    .eq('vendor_id', vendorId)

  await admin
    .from('shop_products')
    .update({ status: 'archived' })
    .eq('vendor_id', vendorId)

  const { error: upErr } = await admin
    .from('vendor_profiles')
    .update({
      status: 'canceled',
      marketplace_enabled: false,
      shop_status: 'off',
    })
    .eq('id', vendorId)

  if (upErr) {
    return { ok: false, status: 500, error: upErr.message, stage: 'vendor_update' }
  }

  logSecurityEvent('info', {
    type: 'partner_account_suspended',
    userId: vendor.user_id as string,
    details: { vendorId, initiatedBy: 'admin' },
  })

  return {
    ok: true,
    preservedConsumerAccount: true,
    vendorId,
    userId: vendor.user_id as string,
  }
}
