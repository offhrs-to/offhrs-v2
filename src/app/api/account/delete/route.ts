import { reconcileEventsByIds } from '@/lib/event-slot-reconcile'
import { processBookingRefund } from '@/lib/booking-refund'
import {
  classifyShopOrderForAccountDeletion,
  isOpenShopClaimStatus,
  shopOrderAnonymizePatch,
  shopOrderDeletionBlockMessage,
  type ShopOrderForAccountDeletion,
} from '@/lib/shop/account-deletion'
import { refundShopOrderPreScan, type ShopOrderRow } from '@/lib/shop/fulfillment'
import { createAdminClient } from '@/lib/supabase/admin'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { logSecurityEvent } from '@/lib/security-monitor'
import { resolveApiUser, extractAccessToken, resolveBearerUser, bearerJwtProjectMismatchMessage } from '@/lib/resolve-api-user'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

const ACTIVE_BOOKING_STATUSES = new Set([
  'confirmed',
  'pending',
  'booked',
  'pending_confirmation',
])

/**
 * POST /api/account/delete
 * Deletes the authenticated consumer's account and user-owned data.
 */
export async function POST(request: NextRequest) {
  try {
    const accessToken = await extractAccessToken(request)

    let user = await resolveApiUser(request)

    // Belt-and-suspenders for mobile: re-validate bearer via service role if cookie path missed.
    if (!user && accessToken) {
      user = await resolveBearerUser(accessToken)
    }

    if (!user) {
      const ipKey = getRateLimitKey(request)
      const probeRl = consumeRateLimit(`account-delete-probe:${ipKey}`, 30)
      if (!probeRl.allowed) {
        logSecurityEvent('warn', {
          type: 'rate_limited',
          route: '/api/account/delete',
          ipKey,
        })
        return NextResponse.json(
          { error: 'Too many requests. Wait a minute and try again.' },
          { status: 429, headers: { 'Retry-After': String(probeRl.retryAfterSeconds) } }
        )
      }

      const mismatch = accessToken ? bearerJwtProjectMismatchMessage(accessToken) : null
      return NextResponse.json(
        {
          error:
            mismatch ??
            (accessToken
              ? 'Could not verify your session. Sign out, sign in again, and retry.'
              : 'Unauthorized — no session token received. Update the app and try again.'),
        },
        { status: 401 }
      )
    }

    // Authenticated deletes only — 5 attempts per 15 minutes (failed auth no longer burns this).
    const userRl = consumeRateLimit(`account-delete-user:${user.id}`, 5, 15 * 60 * 1000)
    if (!userRl.allowed) {
      logSecurityEvent('warn', {
        type: 'rate_limited',
        route: '/api/account/delete',
        userId: user.id,
      })
      return NextResponse.json(
        {
          error: `Too many delete attempts. Try again in about ${userRl.retryAfterSeconds} seconds.`,
        },
        { status: 429, headers: { 'Retry-After': String(userRl.retryAfterSeconds) } }
      )
    }

    const admin = createAdminClient()
    if (!admin) {
      console.error('Account delete: admin client unavailable')
      return NextResponse.json(
        { error: 'Account deletion is not available', stage: 'admin_client' },
        { status: 503 }
      )
    }

    const userId = user.id

    // ── Marketplace orders (hybrid): refund unshipped → block live → anonymize quiet ──
    // Must run before profile / auth wipe so a failed deleteUser never leaves a half-deleted buyer.
    const { data: shopOrders, error: shopOrdersErr } = await admin
      .from('shop_orders')
      .select(
        'id, status, fulfillment_type, first_scan_at, delivered_at, picked_up_at, stripe_dispute_id, product_title, product_id, vendor_id, quantity, stripe_payment_intent_id, stripe_refund_id, stripe_tax_transaction_id, shippo_rate_id, shippo_shipment_id, shippo_transaction_id, shippo_label_url, tracking_number, tracking_url, ship_to_name, ship_to_line1, ship_to_line2, ship_to_city, ship_to_province, ship_to_postal_code, ship_to_country, item_subtotal_cad, paid_at, ship_by_business_days, estimated_stripe_fee_cents, total_cad, buyer_name'
      )
      .eq('user_id', userId)

    const isMissingTableError = (err: { code?: string | null; message?: string | null } | null): boolean => {
      if (!err) return false
      if (err.code === 'PGRST205') return true
      const msg = (err.message ?? '').toLowerCase()
      return msg.includes('could not find the table') || msg.includes('does not exist')
    }

    if (shopOrdersErr) {
      if (!isMissingTableError(shopOrdersErr)) {
        console.error('Account delete: shop_orders lookup', shopOrdersErr.message, userId)
        return NextResponse.json(
          { error: `Failed to look up Marketplace orders: ${shopOrdersErr.message}`, stage: 'shop_orders_lookup' },
          { status: 500 }
        )
      }
      console.warn('Account delete: skipping missing shop_orders table', shopOrdersErr.message)
    }

    const orderIds = (shopOrders ?? []).map((o) => o.id as string)
    const openClaimOrderIds = new Set<string>()
    if (orderIds.length > 0) {
      const { data: claims, error: claimsErr } = await admin
        .from('shop_order_claims')
        .select('order_id, status')
        .in('order_id', orderIds)
      if (claimsErr) {
        console.error('Account delete: shop_order_claims lookup', claimsErr.message, userId)
        return NextResponse.json(
          {
            error: `Failed to look up Marketplace claims: ${claimsErr.message}`,
            stage: 'shop_order_claims_lookup',
          },
          { status: 500 }
        )
      }
      for (const c of claims ?? []) {
        if (isOpenShopClaimStatus(c.status as string) && c.order_id) {
          openClaimOrderIds.add(c.order_id as string)
        }
      }
    }

    const shopDecisions = (shopOrders ?? []).map((order) =>
      classifyShopOrderForAccountDeletion(order as ShopOrderForAccountDeletion, {
        hasOpenClaim: openClaimOrderIds.has(order.id as string),
      })
    )

    const blockMessage = shopOrderDeletionBlockMessage(shopDecisions)
    if (blockMessage) {
      return NextResponse.json(
        {
          error: blockMessage,
          stage: 'shop_order_active',
          blockedOrders: shopDecisions
            .filter((d) => d.action === 'block')
            .map((d) => ({ orderId: d.orderId, reason: d.blockReason, title: d.productTitle })),
        },
        { status: 409 }
      )
    }

    const shopRefundFailures: { orderId: string; error: string }[] = []
    for (const decision of shopDecisions) {
      if (decision.action !== 'refund') continue
      const order = (shopOrders ?? []).find((o) => o.id === decision.orderId)
      if (!order) continue
      try {
        await refundShopOrderPreScan({
          admin,
          stripe,
          order: order as ShopOrderRow,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Marketplace refund failed'
        console.error('Account delete: shop refund failed', decision.orderId, msg, userId)
        shopRefundFailures.push({ orderId: decision.orderId, error: msg })
      }
    }

    if (shopRefundFailures.length > 0) {
      return NextResponse.json(
        {
          error:
            'We could not refund one or more of your Marketplace orders automatically. Please contact support to complete account deletion.',
          failedShopOrders: shopRefundFailures,
          stage: 'shop_order_refund',
        },
        { status: 502 }
      )
    }

    if ((shopOrders ?? []).length > 0) {
      const { error: shopAnonErr } = await admin
        .from('shop_orders')
        .update(shopOrderAnonymizePatch())
        .eq('user_id', userId)
      if (shopAnonErr) {
        console.error('Account delete: anonymize shop_orders failed', shopAnonErr.message, userId)
        return NextResponse.json(
          {
            error: `Failed to anonymize Marketplace orders: ${shopAnonErr.message}`,
            stage: 'shop_orders_anonymize',
          },
          { status: 500 }
        )
      }

      const { error: claimsAnonErr } = await admin
        .from('shop_order_claims')
        .update({ buyer_user_id: null })
        .eq('buyer_user_id', userId)
      if (claimsAnonErr) {
        console.error('Account delete: anonymize shop_order_claims failed', claimsAnonErr.message, userId)
        return NextResponse.json(
          {
            error: `Failed to anonymize Marketplace claims: ${claimsAnonErr.message}`,
            stage: 'shop_order_claims_anonymize',
          },
          { status: 500 }
        )
      }
    }

    // Capture this consumer's booking event_ids BEFORE deletion so we can reconcile
    // available_slots on those events as a safety net.
    const { data: priorBookings } = await admin
      .from('bookings')
      .select('id, event_id, status, refunded_at, stripe_payment_intent_id')
      .eq('user_id', userId)
    const affectedEventIds = Array.from(
      new Set(
        (priorBookings ?? [])
          .map((b: { event_id: string | number | null }) => b.event_id)
          .filter((id): id is string | number => id != null)
      )
    )

    // 1) Refund any active bookings via Stripe BEFORE the booking row is touched.
    //    Account deletion must not strand customer funds in our platform balance.
    //    `processBookingRefund` handles:
    //      - Issuing the Stripe refund (skipped if no PI / already refunded)
    //      - Marking the row status='refunded' + refunded_at
    //      - Restoring event/series slot counts on the vendor side
    //      - Sending the refund confirmation + cancellation emails
    //    We pass skipRefundWindowCheck so the platform's 24h window doesn't block
    //    a refund triggered by account deletion.
    const refundFailures: { bookingId: string; error: string }[] = []
    for (const b of priorBookings ?? []) {
      const status = (b.status as string | null)?.toLowerCase() ?? ''
      const isActive = ACTIVE_BOOKING_STATUSES.has(status) && !b.refunded_at
      if (!isActive) continue

      const result = await processBookingRefund(admin, b.id as string, {
        initiatedBy: 'consumer',
        consumerUserId: userId,
        consumerEmail: user.email ?? null,
        cancellationReason: 'Account deleted by user',
        skipRefundWindowCheck: true,
      })

      if (!result.ok) {
        console.error(
          'Account delete: refund failed for booking',
          b.id,
          result.error,
          userId
        )
        refundFailures.push({ bookingId: b.id as string, error: result.error })
      }
    }

    if (refundFailures.length > 0) {
      // Stop deletion if any refund failed — leave the booking rows intact (with
      // original PII) so support can manually refund via Stripe and try again.
      return NextResponse.json(
        {
          error:
            'We could not refund one or more of your bookings automatically. Please contact support to complete account deletion.',
          failedBookings: refundFailures,
          stage: 'booking_refund',
        },
        { status: 502 }
      )
    }

    // 2) Anonymize PII on this user's bookings instead of hard-deleting them.
    //    Keeps the row for vendor records, refund history, Stripe reconciliation,
    //    and the "Refunded" badge on the partner dashboard. Setting user_id=NULL
    //    also detaches the booking from auth.users so it survives the cascade
    //    when admin.auth.admin.deleteUser() runs below.
    if ((priorBookings ?? []).length > 0) {
      const { error: anonymizeErr } = await admin
        .from('bookings')
        .update({
          user_id: null,
          name: 'Deleted user',
          email: null,
        })
        .eq('user_id', userId)
      if (anonymizeErr) {
        console.error('Account delete: anonymize bookings failed', anonymizeErr.message, userId)
        return NextResponse.json(
          {
            error: `Failed to anonymize bookings: ${anonymizeErr.message}`,
            stage: 'bookings_anonymize',
          },
          { status: 500 }
        )
      }
    }

    // PostgREST "table not found in schema cache" — tolerate so legacy tables that
    // have since been dropped can't block account deletion.
    type DeleteStep = {
      table: string
      run: () => Promise<{ error: { code?: string | null; message: string } | null }>
    }

    // Consumer-owned rows: explicit cleanup per table so a single FK error names the table.
    // Note: bookings are intentionally NOT hard-deleted (they're refunded + anonymized above).
    const consumerSteps: DeleteStep[] = [
      { table: 'user_event_saves', run: async () => admin.from('user_event_saves').delete().eq('user_id', userId) },
      { table: 'user_vendor_saves', run: async () => admin.from('user_vendor_saves').delete().eq('user_id', userId) },
      { table: 'vendor_reviews', run: async () => admin.from('vendor_reviews').delete().eq('user_id', userId) },
      { table: 'profile_category_experience', run: async () => admin.from('profile_category_experience').delete().eq('user_id', userId) },
    ]
    for (const step of consumerSteps) {
      const { error } = await step.run()
      if (error) {
        if (isMissingTableError(error)) {
          console.warn('Account delete: skipping missing table', step.table, error.message)
          continue
        }
        console.error('Account delete: consumer data failed', step.table, error.message, userId)
        return NextResponse.json(
          { error: `Failed to delete ${step.table}: ${error.message}`, stage: step.table },
          { status: 500 }
        )
      }
    }

    // A Supabase auth user can own both account roles:
    // - consumer account: profiles + bookings/saves/reviews
    // - vendor account: vendor_profiles + partner dashboard data
    //
    // Mobile "Delete my account" only deletes the consumer role. If the same
    // login also has a vendor profile, keep auth.users intact so the partner
    // dashboard account is preserved.
    const { data: hostProfiles, error: hostLookupErr } = await admin
      .from('vendor_profiles')
      .select('id')
      .eq('user_id', userId)
    if (hostLookupErr) {
      console.error('Account delete: host lookup', hostLookupErr.message, userId)
      return NextResponse.json(
        { error: `Failed to look up host profile: ${hostLookupErr.message}`, stage: 'vendor_profiles_lookup' },
        { status: 500 }
      )
    }

    const hostIds = (hostProfiles ?? []).map((r: { id: string }) => r.id).filter(Boolean)
    const hasVendorAccount = hostIds.length > 0

    // Delete only the consumer profile row. Vendor profile rows are separate and
    // must survive when the same login is also a partner account.
    const { error: profileErr } = await admin.from('profiles').delete().eq('id', userId)
    if (profileErr) {
      console.error('Account delete: profiles', profileErr.message, userId)
      return NextResponse.json(
        { error: `Failed to delete profile: ${profileErr.message}`, stage: 'profiles' },
        { status: 500 }
      )
    }

    if (hasVendorAccount) {
      try {
        await reconcileEventsByIds(admin, affectedEventIds)
      } catch (reconcileErr) {
        console.error('Account delete: slot reconcile failed', reconcileErr)
      }

      return NextResponse.json({ success: true, preservedVendorAccount: true })
    }

    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      console.error('Account delete: deleteUser', error.message, userId)
      return NextResponse.json(
        { error: `Failed to delete auth user: ${error.message}`, stage: 'auth_user' },
        { status: 500 }
      )
    }

    // Slot reconciliation: belt-and-suspenders. processBookingRefund already
    // restores series_occurrences / available_slots; this just recomputes from
    // active-booking counts in case any prior row was stuck out of sync.
    try {
      await reconcileEventsByIds(admin, affectedEventIds)
    } catch (reconcileErr) {
      console.error('Account delete: slot reconcile failed', reconcileErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Account delete error:', message, err)
    return NextResponse.json({ error: `Internal error: ${message}`, stage: 'exception' }, { status: 500 })
  }
}
