import { syncBookingRefundedFromStripe } from '@/lib/booking-refund'
import { fetchRealChargeFee } from '@/lib/stripe-charge-fees'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getStripeLitePriceId,
  getStripeProPriceId,
  monthlyAmountLabelForTier,
  subscriptionTierFromStripePriceId,
} from '@/lib/stripe-partner-plans'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'

type PartnerSubscriptionTier = 'lite' | 'pro'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

// App Router routes use the Web Request API — no body parser config needed

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return
  const resend = new Resend(process.env.RESEND_API_KEY)
  const from = process.env.RESEND_FROM_EMAIL ?? 'offhrs <noreply@offhrs.app>'
  await resend.emails.send({ from, to, subject, html }).catch(console.error)
}

function emailHtml(body: string): string {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">${body}</div>`
}

function parsePartnerSubscriptionTier(value: unknown): PartnerSubscriptionTier | null {
  return value === 'lite' || value === 'pro' ? value : null
}

function tierFromConfiguredPriceId(priceId: string | null | undefined): PartnerSubscriptionTier | null {
  if (!priceId) return null
  if (priceId === getStripeLitePriceId()) return 'lite'
  if (priceId === getStripeProPriceId()) return 'pro'
  return null
}

function tierFromStripePriceObject(price: Stripe.Price | null | undefined): PartnerSubscriptionTier | null {
  if (!price) return null
  const productName =
    typeof price.product === 'object' && price.product && 'name' in price.product
      ? price.product.name
      : null

  const textParts = [
    price.lookup_key,
    price.nickname,
    productName,
  ]
    .filter(Boolean)
    .map((part) => String(part).toLowerCase())

  if (textParts.some((part) => /\blite\b/.test(part))) return 'lite'
  if (textParts.some((part) => /\bpro\b/.test(part))) return 'pro'

  return null
}

async function tierFromStripePriceId(priceId: string | null | undefined): Promise<PartnerSubscriptionTier | null> {
  const fromConfiguredId = tierFromConfiguredPriceId(priceId)
  if (fromConfiguredId) return fromConfiguredId
  if (!priceId) return null

  try {
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] })
    return tierFromStripePriceObject(price)
  } catch (err) {
    console.warn('Could not resolve Stripe partner tier from price:', priceId, err)
    return null
  }
}

async function resolveInitialPartnerSubscriptionTier(params: {
  subscription: Stripe.Subscription
  session?: Stripe.Checkout.Session
  existingTier?: unknown
}): Promise<PartnerSubscriptionTier> {
  return (
    parsePartnerSubscriptionTier(params.session?.metadata?.plan) ??
    parsePartnerSubscriptionTier(params.subscription.metadata?.plan) ??
    parsePartnerSubscriptionTier(params.existingTier) ??
    await tierFromStripePriceId(params.subscription.items.data[0]?.price.id ?? '') ??
    subscriptionTierFromStripePriceId(params.subscription.items.data[0]?.price.id ?? '')
  )
}

async function resolveCurrentPartnerSubscriptionTier(params: {
  subscription: Stripe.Subscription
  existingTier?: unknown
}): Promise<PartnerSubscriptionTier> {
  return (
    await tierFromStripePriceId(params.subscription.items.data[0]?.price.id ?? '') ??
    parsePartnerSubscriptionTier(params.existingTier) ??
    parsePartnerSubscriptionTier(params.subscription.metadata?.plan) ??
    subscriptionTierFromStripePriceId(params.subscription.items.data[0]?.price.id ?? '')
  )
}

async function resolveVendorIdFromStripeSubscription(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  subscription: Stripe.Subscription
): Promise<string | null> {
  const fromMeta = subscription.metadata?.vendor_id
  if (fromMeta) return fromMeta

  const customer = subscription.customer
  const customerId =
    typeof customer === 'string' ? customer : customer && typeof customer === 'object' && 'id' in customer
      ? (customer as { id: string }).id
      : null

  if (!customerId) return null

  const { data: vp } = await admin
    .from('vendor_profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  return vp?.id ?? null
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  // Determine which secret to use (billing vs. connect webhook)
  const isConnect = request.headers.get('stripe-signature')?.includes('connect') ?? false
  const webhookSecret = isConnect
    ? process.env.STRIPE_CONNECT_WEBHOOK_SECRET!
    : process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    // Try the other secret if first fails (both endpoints share same URL)
    try {
      const altSecret = isConnect
        ? process.env.STRIPE_WEBHOOK_SECRET!
        : process.env.STRIPE_CONNECT_WEBHOOK_SECRET!
      event = stripe.webhooks.constructEvent(rawBody, signature, altSecret)
    } catch {
      console.error('Stripe webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // Idempotency check
  const { data: existing } = await admin
    .from('webhook_events')
    .select('id')
    .eq('event_id', event.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  // Log the event before processing
  await admin.from('webhook_events').insert({
    source: 'stripe',
    event_id: event.id,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
  })

  try {
    await handleStripeEvent(event, admin)

    await admin
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('event_id', event.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Stripe webhook handler error (${event.type}):`, err)
    await admin
      .from('webhook_events')
      .update({ error: message })
      .eq('event_id', event.id)
  }

  return NextResponse.json({ received: true })
}

async function handleStripeEvent(
  event: Stripe.Event,
  admin: NonNullable<ReturnType<typeof createAdminClient>>
) {
  switch (event.type) {
    // ── Subscription created / checkout completed ──────────────────────────
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') break

      const vendorId = session.metadata?.vendor_id
      if (!vendorId) break

      const subscriptionId = session.subscription as string
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)

      const stripePriceId = subscription.items.data[0]?.price.id ?? ''
      const subscription_tier = await resolveInitialPartnerSubscriptionTier({ subscription, session })
      const planLabel = subscription_tier === 'lite' ? 'Lite' : 'Pro'

      // Update vendor to trialing
      await admin.from('vendor_profiles').update({
        status: 'trialing',
        stripe_checkout_completed: true,
        trial_ends_at: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        subscription_current_period_end: subscription.items.data[0]?.current_period_end
          ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
          : null,
      }).eq('id', vendorId)

      // Upsert subscription record
      await admin.from('vendor_subscriptions').upsert({
        vendor_id: vendorId,
        stripe_subscription_id: subscriptionId,
        stripe_price_id: stripePriceId,
        subscription_tier,
        status: subscription.status,
        trial_start: subscription.trial_start
          ? new Date(subscription.trial_start * 1000).toISOString()
          : null,
        trial_end: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        current_period_start: subscription.items.data[0]?.current_period_start
          ? new Date(subscription.items.data[0].current_period_start * 1000).toISOString()
          : null,
        current_period_end: subscription.items.data[0]?.current_period_end
          ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
      }, { onConflict: 'stripe_subscription_id' })

      // Send welcome email
      const { data: vendor } = await admin
        .from('vendor_profiles')
        .select('business_name')
        .eq('id', vendorId)
        .single()

      const { data: authUser } = await admin.auth.admin.getUserById(
        (await admin.from('vendor_profiles').select('user_id').eq('id', vendorId).single()).data?.user_id ?? ''
      )

      if (authUser?.user?.email) {
        await sendEmail(
          authUser.user.email,
          `Welcome to offhrs Partners, ${vendor?.business_name}!`,
          emailHtml(`
            <h2 style="font-size:22px;font-weight:700;margin-bottom:8px;">You're in! 🎉</h2>
            <p style="color:#555;font-size:14px;line-height:1.6;">
              Your 30-day free trial has started on the <strong>${planLabel}</strong> plan.
              After the trial, you&apos;ll be billed ${monthlyAmountLabelForTier(subscription_tier)} unless you cancel before then.
              Next step: set up payouts and publish your first workshop session.
            </p>
            <a href="${APP_URL}/partners/dashboard"
               style="display:inline-block;margin-top:24px;padding:12px 28px;background:#5D755D;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
              Go to dashboard
            </a>
          `)
        )
      }
      break
    }

    // ── Trial ending soon ──────────────────────────────────────────────────
    case 'customer.subscription.trial_will_end': {
      const subscription = event.data.object as Stripe.Subscription
      const vendorId = await resolveVendorIdFromStripeSubscription(admin, subscription)
      if (!vendorId) break

      const { data: subRow } = await admin
        .from('vendor_subscriptions')
        .select('subscription_tier')
        .eq('stripe_subscription_id', subscription.id)
        .maybeSingle()

      const subscription_tier = await resolveCurrentPartnerSubscriptionTier({
        subscription,
        existingTier: subRow?.subscription_tier,
      })
      const amountLine = monthlyAmountLabelForTier(subscription_tier)

      const { data: vp } = await admin
        .from('vendor_profiles')
        .select('user_id, business_name')
        .eq('id', vendorId)
        .single()

      if (vp) {
        const { data: authUser } = await admin.auth.admin.getUserById(vp.user_id)
        if (authUser?.user?.email) {
          await sendEmail(
            authUser.user.email,
            'Your offhrs trial ends in 3 days',
            emailHtml(`
              <h2 style="font-size:22px;font-weight:700;margin-bottom:8px;">Trial ending soon</h2>
              <p style="color:#555;font-size:14px;line-height:1.6;">
                Your free trial ends in 3 days. After that, you&apos;ll be billed ${amountLine}.
                No action needed if you'd like to continue — we'll charge the card on file.
              </p>
              <a href="${APP_URL}/partners/dashboard/settings"
                 style="display:inline-block;margin-top:24px;padding:12px 28px;background:#5D755D;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
                Manage subscription
              </a>
            `)
          )
        }
      }
      break
    }

    // ── Subscription updated ───────────────────────────────────────────────
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const vendorId = await resolveVendorIdFromStripeSubscription(admin, subscription)
      if (!vendorId) break

      const newStatus = stripeStatusToVendorStatus(subscription.status)
      const stripePriceId = subscription.items.data[0]?.price.id ?? ''
      const { data: subRow } = await admin
        .from('vendor_subscriptions')
        .select('subscription_tier')
        .eq('stripe_subscription_id', subscription.id)
        .maybeSingle()
      const subscription_tier = await resolveCurrentPartnerSubscriptionTier({
        subscription,
        existingTier: subRow?.subscription_tier,
      })

      await admin.from('vendor_profiles').update({
        status: newStatus,
        trial_ends_at: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        subscription_current_period_end: subscription.items.data[0]?.current_period_end
          ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
          : null,
      }).eq('id', vendorId)

      await admin.from('vendor_subscriptions').update({
        status: subscription.status,
        stripe_price_id: stripePriceId,
        subscription_tier,
        current_period_start: subscription.items.data[0]?.current_period_start
          ? new Date(subscription.items.data[0].current_period_start * 1000).toISOString()
          : null,
        current_period_end: subscription.items.data[0]?.current_period_end
          ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', subscription.id)
      break
    }

    // ── Subscription deleted / canceled ───────────────────────────────────
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const vendorId = await resolveVendorIdFromStripeSubscription(admin, subscription)
      if (!vendorId) break

      await admin.from('vendor_profiles').update({ status: 'canceled' }).eq('id', vendorId)
      await admin.from('vendor_subscriptions').update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', subscription.id)

      const { data: vp } = await admin
        .from('vendor_profiles')
        .select('user_id, business_name')
        .eq('id', vendorId)
        .single()

      if (vp) {
        const { data: authUser } = await admin.auth.admin.getUserById(vp.user_id)
        if (authUser?.user?.email) {
          await sendEmail(
            authUser.user.email,
            'Your offhrs subscription has been canceled',
            emailHtml(`
              <h2 style="font-size:22px;font-weight:700;margin-bottom:8px;">Subscription canceled</h2>
              <p style="color:#555;font-size:14px;line-height:1.6;">
                Your offhrs Partners subscription has ended. Your data is retained for 30 days.
                You can reactivate at any time.
              </p>
              <a href="${APP_URL}/partners/signup"
                 style="display:inline-block;margin-top:24px;padding:12px 28px;background:#5D755D;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
                Reactivate
              </a>
            `)
          )
        }
      }
      break
    }

    // ── Payment failed ─────────────────────────────────────────────────────
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      const { data: vp } = await admin
        .from('vendor_profiles')
        .select('id, user_id, business_name, status')
        .eq('stripe_customer_id', customerId)
        .single()

      if (!vp) break

      await admin.from('vendor_profiles').update({ status: 'past_due' }).eq('id', vp.id)

      const { data: authUser } = await admin.auth.admin.getUserById(vp.user_id)
      if (authUser?.user?.email) {
        await sendEmail(
          authUser.user.email,
          'Action required: payment failed for offhrs Partners',
          emailHtml(`
            <h2 style="font-size:22px;font-weight:700;margin-bottom:8px;">Payment failed</h2>
            <p style="color:#555;font-size:14px;line-height:1.6;">
              We couldn't charge your card for your offhrs Partners subscription.
              Please update your payment method within 3 days to avoid account suspension.
            </p>
            <a href="${APP_URL}/partners/dashboard/settings"
               style="display:inline-block;margin-top:24px;padding:12px 28px;background:#c0392b;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
              Update payment method
            </a>
          `)
        )
      }
      break
    }

    // ── Payment succeeded ─────────────────────────────────────────────────
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      const { data: vp } = await admin
        .from('vendor_profiles')
        .select('id, status')
        .eq('stripe_customer_id', customerId)
        .single()

      if (!vp) break

      if (vp.status === 'past_due' || vp.status === 'suspended') {
        await admin.from('vendor_profiles').update({ status: 'active' }).eq('id', vp.id)
      }
      break
    }

    // ── Connect: account updated ──────────────────────────────────────────
    case 'account.updated': {
      const account = event.data.object as Stripe.Account
      const { data: vp } = await admin
        .from('vendor_profiles')
        .select('id')
        .eq('stripe_account_id', account.id)
        .single()

      if (!vp) break

      const connectCompleted =
        account.details_submitted && account.charges_enabled && account.payouts_enabled

      if (connectCompleted) {
        await admin.from('vendor_profiles').update({
          stripe_connect_completed: true,
        }).eq('id', vp.id)

        const { data: vendorRow } = await admin
          .from('vendor_profiles')
          .select('location_address')
          .eq('id', vp.id)
          .single()

        try {
          const { ensureConnectedAccountStripeTaxReady } = await import(
            '@/lib/stripe-vendor-tax-setup'
          )
          await ensureConnectedAccountStripeTaxReady(stripe, account.id, {
            locationAddress: vendorRow?.location_address,
          })
        } catch (taxSetupErr) {
          console.warn('Stripe Tax setup on Connect account.updated:', taxSetupErr)
        }
      }
      break
    }

    // ── Connect: payout events ────────────────────────────────────────────
    case 'payout.created':
    case 'payout.paid':
    case 'payout.failed':
    case 'payout.canceled': {
      const payout = event.data.object as Stripe.Payout
      // account is set on Connect events
      const accountId = (event as unknown as { account?: string }).account
      if (!accountId) break

      const { data: vp } = await admin
        .from('vendor_profiles')
        .select('id')
        .eq('stripe_account_id', accountId)
        .single()
      if (!vp) break

      const statusMap: Record<string, string> = {
        'payout.created': 'pending',
        'payout.paid': 'paid',
        'payout.failed': 'failed',
        'payout.canceled': 'canceled',
      }

      await admin.from('vendor_payouts').upsert({
        vendor_id: vp.id,
        stripe_payout_id: payout.id,
        amount_cad: payout.amount / 100,
        arrival_date: new Date(payout.arrival_date * 1000).toISOString().slice(0, 10),
        status: statusMap[event.type] ?? 'pending',
      }, { onConflict: 'stripe_payout_id' })
      break
    }

    // ── Workshop booking refunds (Connect charges / PaymentIntents) ───────
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      const pi =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id ?? null
      if (pi) {
        await syncBookingRefundedFromStripe(admin, pi)
      }
      break
    }

    // ── Reconcile real Stripe processing fee once it's published ──────────
    // `charge.updated` fires when Stripe finalizes the balance_transaction for
    // a charge (and on a few other state transitions). Because the PaymentIntent
    // was created with `on_behalf_of` pointing at the connected account, the BT
    // lives on the connected account's ledger and `event.account` identifies
    // which connected account this charge belongs to.
    //
    // We only touch bookings whose stored `stripe_fee_cad` is still the estimate
    // (i.e. differs from the freshly-pulled real fee) to avoid no-op writes.
    case 'charge.updated': {
      const charge = event.data.object as Stripe.Charge
      if (!charge.balance_transaction) break

      const piId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id ?? null
      if (!piId) break

      const connectedAccountId = (event as unknown as { account?: string }).account
      if (!connectedAccountId) break

      const { data: booking } = await admin
        .from('bookings')
        .select('id, stripe_fee_cad, net_vendor_cad')
        .eq('stripe_payment_intent_id', piId)
        .maybeSingle()
      if (!booking) break

      const real = await fetchRealChargeFee(stripe, charge.id, connectedAccountId)
      if (!real) break

      const storedFee = Number(booking.stripe_fee_cad ?? 0)
      const storedNet = Number(booking.net_vendor_cad ?? 0)
      const feeDelta = Math.abs(storedFee - real.feeCad)
      const netDelta = Math.abs(storedNet - real.netCad)
      // Skip if the numbers already match (within rounding tolerance).
      if (feeDelta < 0.005 && netDelta < 0.005) break

      const { error: updateError } = await admin
        .from('bookings')
        .update({
          stripe_fee_cad: real.feeCad,
          net_vendor_cad: real.netCad,
        })
        .eq('id', booking.id)

      if (updateError) {
        console.error('charge.updated fee reconcile failed:', booking.id, updateError)
      }
      break
    }

    case 'refund.created':
    case 'refund.updated': {
      const refund = event.data.object as Stripe.Refund
      if (refund.status === 'succeeded' && refund.payment_intent) {
        const pi =
          typeof refund.payment_intent === 'string'
            ? refund.payment_intent
            : refund.payment_intent.id
        await syncBookingRefundedFromStripe(admin, pi)
      }
      break
    }

    default:
      break
  }
}

function stripeStatusToVendorStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'trialing': return 'trialing'
    case 'active': return 'active'
    case 'past_due': return 'past_due'
    case 'canceled': return 'canceled'
    case 'unpaid': return 'suspended'
    default: return 'past_due'
  }
}


