/**
 * Centralized email sending via Resend.
 * All 11 notification templates live here.
 */
import { Resend } from 'resend'
import { generateIcs } from './ics'
import { formatWorkshopDateTimeForDisplay, formatWorkshopDateTimeShort } from './workshop-timezone'

const FROM = process.env.RESEND_FROM_EMAIL ?? 'offhrs <noreply@offhrs.app>'

/** Official wordmark — always served from production so preview deploys render correctly in inboxes. */
const EMAIL_LOGO_URL = 'https://offhrs.app/logo.png'

function wrap(body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#F5F2EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
    <div style="background:#5D755D;padding:20px 24px;">
      <img src="${EMAIL_LOGO_URL}" alt="offhrs" width="140" height="36" style="display:block;height:36px;width:auto;max-width:160px;border:0;" />
    </div>
    <div style="padding:28px 24px 32px;">${body}</div>
    <div style="padding:14px 24px;border-top:1px solid #E8E4DE;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">offhrs · Toronto, ON · <a href="https://offhrs.app" style="color:#5D755D;text-decoration:none;">offhrs.app</a></p>
    </div>
  </div>
</body>
</html>`.trim()
}

function h2(text: string) {
  return `<h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1a1a1a;">${text}</h2>`
}
function p(text: string) {
  return `<p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">${text}</p>`
}
function btn(href: string, text: string, color = '#5D755D') {
  return `<a href="${href}" style="display:inline-block;margin-top:8px;padding:12px 28px;background:${color};color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">${text}</a>`
}

function resend() {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

async function send(to: string | string[], subject: string, html: string, attachments?: { filename: string; content: string }[]) {
  const client = resend()
  if (!client) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const { error } = await client.emails.send({
    from: FROM,
    to,
    subject,
    html,
    attachments: attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content).toString('base64'),
    })),
  })

  if (error) {
    console.error('Resend error:', error)
    throw new Error(error.message ?? 'Failed to send email')
  }
}

// ── Vendor emails ────────────────────────────────────────────────────────────

export async function sendVendorWelcome(to: string, businessName: string, dashboardUrl: string) {
  await send(
    to,
    `Welcome to offhrs Partners, ${businessName}!`,
    wrap(`
      ${h2('You\'re in! 🎉')}
      ${p(`Your 30-day free trial has started, <strong>${businessName}</strong>. Next: connect your calendar and create your first session.`)}
      ${p(`<strong>GST/HST on workshop tickets:</strong> If you&apos;re registered with the CRA, open <strong>Settings → Workshop sales tax</strong> and turn it on with your registration number before you publish paid workshops. If you&apos;re a small supplier and not registered, leave it off and click <strong>Save tax settings</strong> so we don&apos;t add tax at checkout.`)}
      ${btn(dashboardUrl, 'Go to dashboard')}
    `)
  )
}

export async function sendVendorTrialEnding(
  to: string,
  daysLeft: number,
  settingsUrl: string,
  monthlyLine = 'your plan rate (see billing settings)'
) {
  await send(
    to,
    'Your offhrs trial ends soon',
    wrap(`
      ${h2(`${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in your trial`)}
      ${p(`Your free trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. After that, you'll be billed ${monthlyLine}. No action needed if you'd like to continue.`)}
      ${btn(settingsUrl, 'Manage subscription')}
    `)
  )
}

export async function sendVendorDunning(to: string, updateUrl: string) {
  await send(
    to,
    'Action required: payment failed for offhrs Partners',
    wrap(`
      ${h2('Payment failed')}
      ${p('We couldn\'t charge your card for your offhrs Partners subscription. Please update your payment method within <strong>3 days</strong> to avoid account suspension.')}
      ${btn(updateUrl, 'Update payment method', '#c0392b')}
    `)
  )
}

export async function sendVendorSuspended(to: string, reactivateUrl: string) {
  await send(
    to,
    'Your offhrs account has been suspended',
    wrap(`
      ${h2('Account suspended')}
      ${p('Your account has been suspended due to a failed payment. Your data is retained. Reactivate anytime by updating your billing.')}
      ${btn(reactivateUrl, 'Reactivate account')}
    `)
  )
}

export async function sendVendorBookingNotification(
  to: string,
  params: {
    businessName: string
    attendeeName: string
    attendeeEmail: string
    sessionTitle: string
    sessionDate: string
    amountCad: number
    dashboardUrl: string
  }
) {
  const { businessName, attendeeName, attendeeEmail, sessionTitle, sessionDate, amountCad, dashboardUrl } = params
  await send(
    to,
    `New booking: ${sessionTitle}`,
    wrap(`
      ${h2('New booking received')}
      ${p(`<strong>${attendeeName}</strong> (${attendeeEmail}) just booked <strong>${sessionTitle}</strong>.`)}
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Session</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;">${sessionTitle}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Date</td><td style="padding:6px 0;font-size:13px;color:#1a1a1a;">${sessionDate}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Amount</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#5D755D;">$${amountCad.toFixed(2)} CAD</td></tr>
      </table>
      ${btn(dashboardUrl, 'View in dashboard')}
    `)
  )
}

export async function sendVendorFullyBooked(to: string, sessionTitle: string, dashboardUrl: string) {
  await send(
    to,
    `Fully booked: ${sessionTitle}`,
    wrap(`
      ${h2('Session fully booked!')}
      ${p(`<strong>${sessionTitle}</strong> is now fully booked. All spots have been filled.`)}
      ${btn(dashboardUrl, 'View bookings')}
    `)
  )
}

export async function sendVendorBookingRefunded(
  to: string,
  params: {
    businessName: string
    attendeeName: string
    attendeeEmail: string | null
    sessionTitle: string
    amountCad: number
    stripeFeeCad: number
    dashboardUrl: string
  }
) {
  const { attendeeName, attendeeEmail, sessionTitle, amountCad, stripeFeeCad, dashboardUrl } = params
  const attendeeLabel = attendeeEmail ? `${attendeeName} (${attendeeEmail})` : attendeeName
  const feeCopy =
    stripeFeeCad > 0
      ? `The Stripe processing fee of <strong>$${stripeFeeCad.toFixed(2)} CAD</strong> on the original transaction is non-refundable by Stripe and remains your responsibility under the offhrs Service Terms.`
      : 'Any Stripe processing fee on the original transaction remains your responsibility under the offhrs Service Terms.'

  await send(
    to,
    `Booking refunded: ${sessionTitle}`,
    wrap(`
      ${h2('Booking refunded')}
      ${p(`<strong>${attendeeLabel}</strong>'s booking for <strong>${sessionTitle}</strong> was refunded.`)}
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Amount refunded to client</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;">$${amountCad.toFixed(2)} CAD</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Stripe processing fee</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;">$${Math.max(0, stripeFeeCad).toFixed(2)} CAD</td></tr>
      </table>
      ${p(feeCopy)}
      ${btn(dashboardUrl, 'View booking')}
    `)
  )
}

// ── Consumer emails ──────────────────────────────────────────────────────────

export interface BookingEmailParams {
  attendeeName: string
  attendeeEmail: string
  sessionTitle: string
  vendorName: string
  sessionDate: Date
  durationMinutes: number
  location: string | null
  vendorWebsite: string | null
  bookingRef: string
  amountCad: number
  /** Cancellation policy summary (strict or flexible) shown in confirmation email. */
  cancellationPolicyLine?: string | null
}

function buildIcs(params: BookingEmailParams, method: 'REQUEST' | 'CANCEL' = 'REQUEST'): string {
  const dtend = new Date(params.sessionDate.getTime() + params.durationMinutes * 60 * 1000)
  return generateIcs({
    uid: `booking-${params.bookingRef}@offhrs.app`,
    summary: `${params.vendorName} — ${params.sessionTitle}`,
    description: `Booking reference: ${params.bookingRef}`,
    location: params.location ?? undefined,
    url: params.vendorWebsite ?? 'https://offhrs.app',
    dtstart: params.sessionDate,
    dtend,
    organizer: { name: params.vendorName, email: FROM.includes('<') ? FROM.split('<')[1].replace('>', '') : FROM },
    method,
  })
}

export async function sendConsumerBookingConfirmation(params: BookingEmailParams) {
  const ics = buildIcs(params)
  const dateStr = formatWorkshopDateTimeForDisplay(params.sessionDate)

  await send(
    params.attendeeEmail,
    `You're booked: ${params.sessionTitle}`,
    wrap(`
      ${h2('Booking confirmed!')}
      ${p(`Hi ${params.attendeeName}, you're all set for <strong>${params.sessionTitle}</strong> with ${params.vendorName}.`)}
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Session</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;">${params.sessionTitle}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Date</td><td style="padding:6px 0;font-size:13px;color:#1a1a1a;">${dateStr}</td></tr>
        ${params.location ? `<tr><td style="padding:6px 0;font-size:13px;color:#888;">Location</td><td style="padding:6px 0;font-size:13px;color:#1a1a1a;">${params.location}</td></tr>` : ''}
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Amount paid</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;">$${params.amountCad.toFixed(2)} CAD</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Booking ref</td><td style="padding:6px 0;font-size:13px;color:#888;font-family:monospace;">${params.bookingRef}</td></tr>
      </table>
      ${params.cancellationPolicyLine ? p(`<strong>Cancellation policy:</strong> ${params.cancellationPolicyLine}`) : ''}
      ${p('A calendar invite is attached. See you there!')}
    `),
    [{ filename: 'booking.ics', content: ics }]
  )
}

export async function sendConsumerBookingCancelled(params: BookingEmailParams) {
  const ics = buildIcs(params, 'CANCEL')
  await send(
    params.attendeeEmail,
    `Booking cancelled: ${params.sessionTitle}`,
    wrap(`
      ${h2('Booking cancelled')}
      ${p(`Your booking for <strong>${params.sessionTitle}</strong> with ${params.vendorName} has been cancelled. If you're eligible for a refund, it will appear on your card within 5–10 business days.`)}
      ${p(`Booking reference: <code>${params.bookingRef}</code>`)}
    `),
    [{ filename: 'cancellation.ics', content: ics }]
  )
}

export async function sendConsumerBookingRescheduled(
  params: BookingEmailParams,
  oldDate: Date
) {
  const ics = buildIcs(params)
  const oldStr = formatWorkshopDateTimeShort(oldDate)
  const newStr = formatWorkshopDateTimeShort(params.sessionDate)

  await send(
    params.attendeeEmail,
    `Rescheduled: ${params.sessionTitle}`,
    wrap(`
      ${h2('Your booking has been rescheduled')}
      ${p(`<strong>${params.sessionTitle}</strong> with ${params.vendorName} has been moved.`)}
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Previous date</td><td style="padding:6px 0;font-size:13px;color:#888;text-decoration:line-through;">${oldStr}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">New date</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;">${newStr}</td></tr>
        ${params.location ? `<tr><td style="padding:6px 0;font-size:13px;color:#888;">Location</td><td style="padding:6px 0;font-size:13px;color:#1a1a1a;">${params.location}</td></tr>` : ''}
      </table>
      ${p('An updated calendar invite is attached.')}
    `),
    [{ filename: 'updated-booking.ics', content: ics }]
  )
}

export async function sendConsumerRefundConfirmation(
  to: string,
  attendeeName: string,
  sessionTitle: string,
  amountCad: number,
  bookingRef: string,
  cancellationIcsParams?: BookingEmailParams
) {
  const attachments = cancellationIcsParams
    ? [{ filename: 'cancellation.ics', content: buildIcs(cancellationIcsParams, 'CANCEL') }]
    : undefined
  await send(
    to,
    `Refund issued: ${sessionTitle}`,
    wrap(`
      ${h2('Refund issued - booking cancelled')}
      ${p(`Hi ${attendeeName}, your booking for <strong>${sessionTitle}</strong> has been cancelled and a refund of <strong>$${amountCad.toFixed(2)} CAD</strong> has been issued to your original payment method.`)}
      ${p(`Refunds typically appear on your card within 5–10 business days.<br>Booking reference: <code>${bookingRef}</code>`)}
    `),
    attachments
  )
}

export async function sendShopBuyerOrderConfirmation(params: {
  to: string
  buyerName: string
  productTitle: string
  vendorName: string
  totalCad: number
  fulfillmentType: 'ship' | 'pickup'
  shipByDays: number
  pickupHours?: string | null
}) {
  const fulfillment =
    params.fulfillmentType === 'pickup'
      ? 'Local pickup — see pickup hours in the app (Profile → Orders).'
      : `The maker will ship within ${params.shipByDays} business days.`
  await send(
    params.to,
    `Order confirmed: ${params.productTitle}`,
    wrap(`
      ${h2('Order confirmed')}
      ${p(`Hi ${escapeHtml(params.buyerName)}, thanks for your purchase from <strong>${escapeHtml(params.vendorName)}</strong>.`)}
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Item</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;">${escapeHtml(params.productTitle)}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Total</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#5D755D;">$${params.totalCad.toFixed(2)} CAD</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Fulfillment</td><td style="padding:6px 0;font-size:13px;color:#1a1a1a;">${escapeHtml(fulfillment)}</td></tr>
      </table>
      ${params.pickupHours ? p(`Pickup hours: ${escapeHtml(params.pickupHours)}`) : ''}
      ${p('View this order anytime in the offhrs app under Profile → Orders.')}
    `)
  )
}

export async function sendShopSellerNewOrder(params: {
  to: string
  businessName: string
  buyerName: string
  productTitle: string
  totalCad: number
  fulfillmentType: 'ship' | 'pickup'
  shipByDays: number
  dashboardUrl: string
}) {
  const action =
    params.fulfillmentType === 'pickup'
      ? 'Mark the order picked up when the buyer collects it.'
      : `Print a Canada Post label in Marketplace → Orders. Ship within ${params.shipByDays} business days.`
  await send(
    params.to,
    `New Marketplace order: ${params.productTitle}`,
    wrap(`
      ${h2('New Marketplace order')}
      ${p(`<strong>${escapeHtml(params.buyerName)}</strong> purchased <strong>${escapeHtml(params.productTitle)}</strong>.`)}
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Total paid</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#5D755D;">$${params.totalCad.toFixed(2)} CAD</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Fulfillment</td><td style="padding:6px 0;font-size:13px;color:#1a1a1a;">${params.fulfillmentType === 'pickup' ? 'Local pickup' : 'Ship'}</td></tr>
      </table>
      ${p(action)}
      ${btn(params.dashboardUrl, 'Open orders')}
    `)
  )
}

export async function sendShopSellerDay3Reminder(params: {
  to: string
  productTitle: string
  shipByDays: number
  dashboardUrl: string
}) {
  await send(
    params.to,
    `Reminder: print label for ${params.productTitle}`,
    wrap(`
      ${h2('Ship-by reminder')}
      ${p(`<strong>${escapeHtml(params.productTitle)}</strong> still needs a shipping label. Please print the label and drop it at Canada Post within your ${params.shipByDays}-business-day window.`)}
      ${btn(params.dashboardUrl, 'Print label')}
    `)
  )
}

export async function sendShopBuyerShipped(params: {
  to: string
  buyerName: string
  productTitle: string
  trackingNumber?: string | null
  trackingUrl?: string | null
}) {
  const tracking = params.trackingNumber
    ? `<tr><td style="padding:6px 0;font-size:13px;color:#888;">Tracking</td><td style="padding:6px 0;font-size:13px;color:#1a1a1a;">${escapeHtml(params.trackingNumber)}</td></tr>`
    : ''
  await send(
    params.to,
    `Your order is on the way: ${params.productTitle}`,
    wrap(`
      ${h2('Your order is on the way')}
      ${p(`Hi ${escapeHtml(params.buyerName)}, <strong>${escapeHtml(params.productTitle)}</strong> has been scanned by Canada Post.`)}
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">${tracking}</table>
      ${params.trackingUrl ? btn(params.trackingUrl, 'Track package') : ''}
    `)
  )
}

export async function sendShopBuyerRefunded(params: {
  to: string
  buyerName: string
  productTitle: string
  totalCad: number
}) {
  await send(
    params.to,
    `Refund issued: ${params.productTitle}`,
    wrap(`
      ${h2('Refund issued')}
      ${p(`Hi ${escapeHtml(params.buyerName)}, your order for <strong>${escapeHtml(params.productTitle)}</strong> has been refunded ($${params.totalCad.toFixed(2)} CAD).`)}
      ${p('The refund will appear on your original payment method. This order was cancelled before the carrier scanned the parcel.')}
    `)
  )
}

export async function sendShopDisputeOpened(params: {
  to: string
  productTitle: string
  disputeId: string
  amountCad: number
  reason?: string | null
}) {
  await send(
    params.to,
    `Marketplace dispute opened: ${params.productTitle}`,
    wrap(`
      ${h2('Chargeback / dispute opened')}
      ${p(`A Stripe dispute was opened for <strong>${escapeHtml(params.productTitle)}</strong>.`)}
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Amount</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;">$${params.amountCad.toFixed(2)} CAD</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Reason</td><td style="padding:6px 0;font-size:13px;color:#1a1a1a;">${escapeHtml(params.reason ?? '—')}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Dispute ID</td><td style="padding:6px 0;font-size:13px;color:#1a1a1a;"><code>${escapeHtml(params.disputeId)}</code></td></tr>
      </table>
      ${p('Please gather evidence (label, tracking, packing/pickup proof) and respond in Stripe. Lost disputes are clawed back from your Connect balance per our Service Terms.')}
    `)
  )
}

export async function sendShopDisputeLost(params: {
  to: string
  productTitle: string
  amountCad: number
  clawbackOk: boolean
}) {
  await send(
    params.to,
    `Marketplace dispute lost: ${params.productTitle}`,
    wrap(`
      ${h2('Dispute lost')}
      ${p(`The dispute for <strong>${escapeHtml(params.productTitle)}</strong> was lost. Clawback amount: <strong>$${params.amountCad.toFixed(2)} CAD</strong> (includes Stripe dispute fee where applicable).`)}
      ${p(params.clawbackOk ? 'The amount was debited from your Connect balance.' : 'Automatic clawback could not complete — offhrs will follow up or retry.')}
    `)
  )
}

export async function sendShopDisputeWon(params: {
  to: string
  productTitle: string
}) {
  await send(
    params.to,
    `Marketplace dispute won: ${params.productTitle}`,
    wrap(`
      ${h2('Dispute won')}
      ${p(`Good news — the dispute for <strong>${escapeHtml(params.productTitle)}</strong> was won. No clawback is due for this dispute.`)}
    `)
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Ops / security alert email. Callers should fire-and-forget. */
export async function sendSecurityAlertEmail(opts: {
  to: string | string[]
  severity: 'warn' | 'critical'
  eventType: string
  route?: string | null
  ipKey?: string | null
  details?: Record<string, unknown> | null
  ts?: string
}): Promise<void> {
  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to])
    .map((t) => t.trim())
    .filter(Boolean)
  if (recipients.length === 0) return

  const badge = opts.severity === 'critical' ? '#B91C1C' : '#B45309'
  const detailsJson = opts.details
    ? `<pre style="margin:0 0 16px;padding:12px;background:#F5F2EE;border-radius:8px;font-size:12px;overflow:auto;color:#333;">${escapeHtml(
        JSON.stringify(opts.details, null, 2)
      )}</pre>`
    : ''

  await send(
    recipients,
    `[offhrs ${opts.severity.toUpperCase()}] ${opts.eventType}`,
    wrap(`
      <p style="margin:0 0 12px;"><span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${badge};color:#fff;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">${opts.severity}</span></p>
      ${h2(opts.eventType)}
      ${p('A security event was recorded on the offhrs API.')}
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px;">
        <tr><td style="padding:4px 0;color:#888;">Time</td><td style="padding:4px 0;color:#1a1a1a;">${escapeHtml(opts.ts ?? new Date().toISOString())}</td></tr>
        <tr><td style="padding:4px 0;color:#888;">Route</td><td style="padding:4px 0;color:#1a1a1a;">${escapeHtml(opts.route ?? '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#888;">IP key</td><td style="padding:4px 0;color:#1a1a1a;">${escapeHtml(opts.ipKey ?? '—')}</td></tr>
      </table>
      ${detailsJson}
      ${p('Check Vercel logs for <code>[SECURITY_EVENT]</code> and the <code>security_events</code> table in Supabase.')}
    `)
  )
}

