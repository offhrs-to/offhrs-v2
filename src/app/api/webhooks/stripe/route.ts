import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil',
})

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

// Disable body parsing — Stripe needs the raw body for signature verification
export const config = { api: { bodyParser: false } }

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return
  const resend = new Resend(process.env.RESEND_API_KEY)
  const from = process.env.RESEND_FROM_EMAIL ?? 'offhrs <noreply@offhrs.app>'
  await resend.emails.send({ from, to, subject, html }).catch(console.error)
}

function emailHtml(body: string): string {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">${body}</div>`
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

      // Update vendor to trialing
      await admin.from('vendor_profiles').update({
        status: 'trialing',
        stripe_checkout_completed: true,
        trial_ends_at: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        subscription_current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
      }).eq('id', vendorId)

      // Upsert subscription record
      await admin.from('vendor_subscriptions').upsert({
        vendor_id: vendorId,
        stripe_subscription_id: subscriptionId,
        stripe_price_id: subscription.items.data[0]?.price.id ?? '',
        status: subscription.status,
        trial_start: subscription.trial_start
          ? new Date(subscription.trial_start * 1000).toISOString()
          : null,
        trial_end: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        current_period_start: subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null,
        current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
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
              Your 7-day free trial has started. Next step: connect your calendar and create your first session.
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
      const vendorId = subscription.metadata?.vendor_id
      if (!vendorId) break

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
                Your free trial ends in 3 days. After that, you'll be billed $79 CAD/month.
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
      const vendorId = subscription.metadata?.vendor_id
      if (!vendorId) break

      const newStatus = stripeStatusToVendorStatus(subscription.status)

      await admin.from('vendor_profiles').update({
        status: newStatus,
        trial_ends_at: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        subscription_current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
      }).eq('id', vendorId)

      await admin.from('vendor_subscriptions').update({
        status: subscription.status,
        current_period_start: subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null,
        current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', subscription.id)
      break
    }

    // ── Subscription deleted / canceled ───────────────────────────────────
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const vendorId = subscription.metadata?.vendor_id
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
