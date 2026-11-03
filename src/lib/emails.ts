/**
 * Centralized transactional email sending via Resend.
 * Layout: editorial cream / ink / sage shell (O'sric-inspired, offhrs brand).
 */
import { Resend } from 'resend'
import {
  emailButton,
  emailCode,
  emailDetails,
  emailEyebrow,
  emailLead,
  emailMoney,
  emailNote,
  emailStrong,
  emailTitle,
  escapeHtml,
  wrapEmailHtml,
} from '@/lib/email-layout'
import { generateIcs } from './ics'
import { formatWorkshopDateTimeForDisplay, formatWorkshopDateTimeShort } from './workshop-timezone'

export { wrapEmailHtml }

const FROM = process.env.RESEND_FROM_EMAIL ?? 'offhrs <notifications@offhrs.app>'

function wrap(body: string): string {
  return wrapEmailHtml(body)
}

function resend() {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

async function send(
  to: string | string[],
  subject: string,
  html: string,
  attachments?: { filename: string; content: string }[]
) {
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

// ── Vendor / Partners ────────────────────────────────────────────────────────

export async function sendVendorWelcome(to: string, businessName: string, dashboardUrl: string) {
  await send(
    to,
    `Welcome to offhrs Partners, ${businessName}!`,
    wrap(`
      ${emailEyebrow('Partners')}
      ${emailTitle('Welcome aboard')}
      ${emailLead(
        `Your 30-day free trial has started, ${emailStrong(businessName)}. Next: connect payouts and create your first session.`
      )}
      ${emailNote(
        `<strong style="color:#2D302B;">GST/HST on workshop tickets:</strong> If you&apos;re registered with the CRA, open <strong style="color:#2D302B;">Settings → Workshop sales tax</strong> and turn it on with your registration number before you publish paid workshops. If you&apos;re a small supplier and not registered, leave it off and click <strong style="color:#2D302B;">Save tax settings</strong>.`
      )}
      ${emailButton(dashboardUrl, 'Go to dashboard')}
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
      ${emailEyebrow('Billing')}
      ${emailTitle(`${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in your trial`)}
      ${emailLead(
        `Your free trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. After that, you&apos;ll be billed ${escapeHtml(monthlyLine)}. No action needed if you&apos;d like to continue.`
      )}
      ${emailButton(settingsUrl, 'Manage subscription')}
    `)
  )
}

export async function sendVendorDunning(to: string, updateUrl: string) {
  await send(
    to,
    'Action required: payment failed for offhrs Partners',
    wrap(`
      ${emailEyebrow('Action required')}
      ${emailTitle('Payment failed')}
      ${emailLead(
        'We couldn&apos;t charge your card for your offhrs Partners subscription. Please update your payment method within <strong style="color:#2D302B;">3 days</strong> to avoid account suspension.'
      )}
      ${emailButton(updateUrl, 'Update payment method', 'danger')}
    `)
  )
}

export async function sendVendorSuspended(to: string, reactivateUrl: string) {
  await send(
    to,
    'Your offhrs account has been suspended',
    wrap(`
      ${emailEyebrow('Account')}
      ${emailTitle('Account suspended')}
      ${emailLead(
        'Your account has been suspended due to a failed payment. Your data is retained. Reactivate anytime by updating your billing.'
      )}
      ${emailButton(reactivateUrl, 'Reactivate account')}
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
  const { attendeeName, attendeeEmail, sessionTitle, sessionDate, amountCad, dashboardUrl } = params
  await send(
    to,
    `New booking: ${sessionTitle}`,
    wrap(`
      ${emailEyebrow('Workshop')}
      ${emailTitle('New booking received')}
      ${emailLead(
        `${emailStrong(attendeeName)} (${escapeHtml(attendeeEmail)}) just booked ${emailStrong(sessionTitle)}.`
      )}
      ${emailDetails([
        { label: 'Session', valueHtml: escapeHtml(sessionTitle) },
        { label: 'Date', valueHtml: escapeHtml(sessionDate) },
        { label: 'Amount', valueHtml: emailMoney(amountCad) },
      ])}
      ${emailButton(dashboardUrl, 'View in dashboard')}
    `)
  )
}

export async function sendVendorFullyBooked(to: string, sessionTitle: string, dashboardUrl: string) {
  await send(
    to,
    `Fully booked: ${sessionTitle}`,
    wrap(`
      ${emailEyebrow('Workshop')}
      ${emailTitle('Session fully booked')}
      ${emailLead(`${emailStrong(sessionTitle)} is now fully booked. All spots have been filled.`)}
      ${emailButton(dashboardUrl, 'View bookings')}
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
  const attendeeLabel = attendeeEmail
    ? `${escapeHtml(attendeeName)} (${escapeHtml(attendeeEmail)})`
    : escapeHtml(attendeeName)
  const feeCopy =
    stripeFeeCad > 0
      ? `The Stripe processing fee of ${emailMoney(stripeFeeCad)} on the original transaction is non-refundable by Stripe and remains your responsibility under the offhrs Service Terms.`
      : 'Any Stripe processing fee on the original transaction remains your responsibility under the offhrs Service Terms.'

  await send(
    to,
    `Booking refunded: ${sessionTitle}`,
    wrap(`
      ${emailEyebrow('Workshop refund')}
      ${emailTitle('Booking refunded')}
      ${emailLead(
        `<strong style="color:#2D302B;">${attendeeLabel}</strong>&apos;s booking for ${emailStrong(sessionTitle)} was refunded.`
      )}
      ${emailDetails([
        { label: 'Refunded to client', valueHtml: emailMoney(amountCad) },
        { label: 'Stripe fee', valueHtml: emailMoney(Math.max(0, stripeFeeCad)) },
      ])}
      ${emailNote(feeCopy)}
      ${emailButton(dashboardUrl, 'View booking')}
    `)
  )
}

// ── Consumer workshops ───────────────────────────────────────────────────────

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
    organizer: {
      name: params.vendorName,
      email: FROM.includes('<') ? FROM.split('<')[1].replace('>', '') : FROM,
    },
    method,
  })
}

export async function sendConsumerBookingConfirmation(params: BookingEmailParams) {
  const ics = buildIcs(params)
  const dateStr = formatWorkshopDateTimeForDisplay(params.sessionDate)
  const rows = [
    { label: 'Session', valueHtml: escapeHtml(params.sessionTitle) },
    { label: 'Host', valueHtml: escapeHtml(params.vendorName) },
    { label: 'Date', valueHtml: escapeHtml(dateStr) },
    ...(params.location
      ? [{ label: 'Location', valueHtml: escapeHtml(params.location) }]
      : []),
    { label: 'Amount paid', valueHtml: emailMoney(params.amountCad) },
    { label: 'Booking ref', valueHtml: emailCode(params.bookingRef) },
  ]

  await send(
    params.attendeeEmail,
    `You're booked: ${params.sessionTitle}`,
    wrap(`
      ${emailEyebrow('Workshop confirmation')}
      ${emailTitle('You\'re booked')}
      ${emailLead(
        `Hi ${escapeHtml(params.attendeeName)}, you&apos;re all set for ${emailStrong(params.sessionTitle)} with ${escapeHtml(params.vendorName)}.`
      )}
      ${emailDetails(rows)}
      ${
        params.cancellationPolicyLine
          ? emailNote(
              `<strong style="color:#2D302B;">Cancellation policy:</strong> ${escapeHtml(params.cancellationPolicyLine)}`
            )
          : ''
      }
      ${emailNote('A calendar invite is attached. See you there.')}
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
      ${emailEyebrow('Workshop cancellation')}
      ${emailTitle('Booking cancelled')}
      ${emailLead(
        `Your booking for ${emailStrong(params.sessionTitle)} with ${escapeHtml(params.vendorName)} has been cancelled. If you&apos;re eligible for a refund, it will appear on your card within 5–10 business days.`
      )}
      ${emailDetails([{ label: 'Booking ref', valueHtml: emailCode(params.bookingRef) }])}
    `),
    [{ filename: 'cancellation.ics', content: ics }]
  )
}

export async function sendConsumerBookingRescheduled(params: BookingEmailParams, oldDate: Date) {
  const ics = buildIcs(params)
  const oldStr = formatWorkshopDateTimeShort(oldDate)
  const newStr = formatWorkshopDateTimeShort(params.sessionDate)

  await send(
    params.attendeeEmail,
    `Rescheduled: ${params.sessionTitle}`,
    wrap(`
      ${emailEyebrow('Workshop update')}
      ${emailTitle('Your booking was rescheduled')}
      ${emailLead(
        `${emailStrong(params.sessionTitle)} with ${escapeHtml(params.vendorName)} has been moved.`
      )}
      ${emailDetails([
        {
          label: 'Previous date',
          valueHtml: `<span style="text-decoration:line-through;color:#6B6E68;">${escapeHtml(oldStr)}</span>`,
        },
        { label: 'New date', valueHtml: `<strong style="color:#2D302B;">${escapeHtml(newStr)}</strong>` },
        ...(params.location
          ? [{ label: 'Location', valueHtml: escapeHtml(params.location) }]
          : []),
      ])}
      ${emailNote('An updated calendar invite is attached.')}
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
      ${emailEyebrow('Workshop refund')}
      ${emailTitle('Refund issued')}
      ${emailLead(
        `Hi ${escapeHtml(attendeeName)}, your booking for ${emailStrong(sessionTitle)} has been cancelled and a refund of ${emailMoney(amountCad)} has been issued to your original payment method.`
      )}
      ${emailDetails([
        { label: 'Refund', valueHtml: emailMoney(amountCad) },
        { label: 'Booking ref', valueHtml: emailCode(bookingRef) },
      ])}
      ${emailNote('Refunds typically appear on your card within 5–10 business days.')}
    `),
    attachments
  )
}

// ── Marketplace ──────────────────────────────────────────────────────────────

export async function sendShopBuyerOrderConfirmation(params: {
  to: string
  buyerName: string
  productTitle: string
  vendorName: string
  orderId: string
  orderDateLabel: string
  itemSubtotalCad: number
  shippingCad: number
  taxCad: number
  totalCad: number
  fulfillmentType: 'ship' | 'pickup'
  deliveryDisclosure: string
  cancelReturnDisclosure: string
  sellerAddress?: string | null
  sellerWebsite?: string | null
  supportEmail: string
  termsVersion: string
  termsUrl: string
}) {
  const money = (n: number) => emailMoney(n)
  const rows = [
    { label: 'Order ID', valueHtml: emailCode(params.orderId) },
    { label: 'Order date', valueHtml: escapeHtml(params.orderDateLabel) },
    { label: 'Seller', valueHtml: `<strong style="color:#2D302B;">${escapeHtml(params.vendorName)}</strong>` },
    ...(params.sellerAddress
      ? [
          {
            label: 'Seller address',
            valueHtml: `<span style="white-space:pre-line;">${escapeHtml(params.sellerAddress)}</span>`,
          },
        ]
      : []),
    ...(params.sellerWebsite
      ? [{ label: 'Seller website', valueHtml: escapeHtml(params.sellerWebsite) }]
      : []),
    { label: 'Item', valueHtml: `<strong style="color:#2D302B;">${escapeHtml(params.productTitle)}</strong>` },
    { label: 'Item price', valueHtml: money(params.itemSubtotalCad) },
    {
      label: 'Shipping',
      valueHtml:
        params.fulfillmentType === 'pickup' ? 'Pickup (no shipping charge)' : money(params.shippingCad),
    },
    { label: 'Tax', valueHtml: money(params.taxCad) },
    { label: 'Total paid', valueHtml: money(params.totalCad) },
    { label: 'Delivery', valueHtml: escapeHtml(params.deliveryDisclosure) },
    { label: 'Cancel / returns', valueHtml: escapeHtml(params.cancelReturnDisclosure) },
    {
      label: 'Support',
      valueHtml: `<a href="mailto:${escapeHtml(params.supportEmail)}" style="color:#5D755D;text-decoration:none;">${escapeHtml(params.supportEmail)}</a> · Profile → Orders in the app`,
    },
    {
      label: 'Terms',
      valueHtml: `Version ${escapeHtml(params.termsVersion)} · <a href="${escapeHtml(params.termsUrl)}" style="color:#5D755D;text-decoration:none;">Terms of Use</a>`,
    },
  ]

  await send(
    params.to,
    `Order confirmed: ${params.productTitle}`,
    wrap(`
      ${emailEyebrow('Marketplace order')}
      ${emailTitle('Order confirmed')}
      ${emailLead(
        `Hi ${escapeHtml(params.buyerName)}, thanks for your purchase from ${emailStrong(params.vendorName)} on the offhrs Artist Marketplace.`
      )}
      ${emailDetails(rows)}
      ${emailNote('View this order anytime in the offhrs app under Profile → Orders.')}
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
      ${emailEyebrow('Marketplace')}
      ${emailTitle('New Marketplace order')}
      ${emailLead(
        `${emailStrong(params.buyerName)} purchased ${emailStrong(params.productTitle)}.`
      )}
      ${emailDetails([
        { label: 'Total paid', valueHtml: emailMoney(params.totalCad) },
        {
          label: 'Fulfillment',
          valueHtml: params.fulfillmentType === 'pickup' ? 'Local pickup' : 'Ship',
        },
      ])}
      ${emailNote(action)}
      ${emailButton(params.dashboardUrl, 'Open orders')}
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
      ${emailEyebrow('Marketplace reminder')}
      ${emailTitle('Ship-by reminder')}
      ${emailLead(
        `${emailStrong(params.productTitle)} still needs a shipping label. Please print the label and drop it at Canada Post within your ${params.shipByDays}-business-day window.`
      )}
      ${emailButton(params.dashboardUrl, 'Print label')}
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
  await send(
    params.to,
    `Your order is on the way: ${params.productTitle}`,
    wrap(`
      ${emailEyebrow('Marketplace shipping')}
      ${emailTitle('Your order is on the way')}
      ${emailLead(
        `Hi ${escapeHtml(params.buyerName)}, ${emailStrong(params.productTitle)} has been scanned by Canada Post.`
      )}
      ${
        params.trackingNumber
          ? emailDetails([{ label: 'Tracking', valueHtml: escapeHtml(params.trackingNumber) }])
          : ''
      }
      ${params.trackingUrl ? emailButton(params.trackingUrl, 'Track package') : ''}
    `)
  )
}

export async function sendVendorShopOrderRefunded(
  to: string,
  params: {
    productTitle: string
    buyerName: string
    totalCad: number
    stripeFeeCad: number
    dashboardUrl: string
    initiatedBy?: 'buyer' | 'seller' | 'platform'
  }
) {
  const feeCopy =
    params.stripeFeeCad > 0
      ? `The Stripe processing fee of ${emailMoney(params.stripeFeeCad)} on the original transaction is non-refundable by Stripe and remains your responsibility under the offhrs Service Terms.`
      : 'Any Stripe processing fee on the original transaction remains your responsibility under the offhrs Service Terms.'

  const who =
    params.initiatedBy === 'buyer'
      ? `${emailStrong(params.buyerName)} cancelled their order for ${emailStrong(params.productTitle)} before carrier First Scan. A full refund was issued automatically.`
      : params.initiatedBy === 'platform'
        ? `The order for ${emailStrong(params.productTitle)} was cancelled by offhrs before carrier First Scan and refunded to the buyer.`
        : `${emailStrong(params.buyerName)}&apos;s order for ${emailStrong(params.productTitle)} was refunded before carrier First Scan.`

  await send(
    to,
    params.initiatedBy === 'buyer'
      ? `Buyer cancelled: ${params.productTitle}`
      : `Marketplace order refunded: ${params.productTitle}`,
    wrap(`
      ${emailEyebrow(params.initiatedBy === 'buyer' ? 'Marketplace cancellation' : 'Marketplace refund')}
      ${emailTitle(params.initiatedBy === 'buyer' ? 'Buyer cancelled order' : 'Marketplace order refunded')}
      ${emailLead(who)}
      ${emailDetails([
        { label: 'Refunded to buyer', valueHtml: emailMoney(params.totalCad) },
        { label: 'Stripe fee', valueHtml: emailMoney(Math.max(0, params.stripeFeeCad)) },
      ])}
      ${emailNote(feeCopy)}
      ${emailButton(params.dashboardUrl, 'View Marketplace orders')}
    `)
  )
}

export async function sendShopBuyerRefunded(params: {
  to: string
  buyerName: string
  productTitle: string
  totalCad: number
  cancelledByBuyer?: boolean
}) {
  const headline = params.cancelledByBuyer ? 'Cancellation confirmed' : 'Refund issued'
  const subject = params.cancelledByBuyer
    ? `Order cancelled: ${params.productTitle}`
    : `Refund issued: ${params.productTitle}`
  const lead = params.cancelledByBuyer
    ? `Hi ${escapeHtml(params.buyerName)}, your cancellation for ${emailStrong(params.productTitle)} is confirmed. We&apos;ve refunded ${emailMoney(params.totalCad)} to your original payment method.`
    : `Hi ${escapeHtml(params.buyerName)}, your order for ${emailStrong(params.productTitle)} has been refunded (${emailMoney(params.totalCad)}).`

  await send(
    params.to,
    subject,
    wrap(`
      ${emailEyebrow(params.cancelledByBuyer ? 'Marketplace cancellation' : 'Marketplace refund')}
      ${emailTitle(headline)}
      ${emailLead(lead)}
      ${emailDetails([{ label: 'Refund', valueHtml: emailMoney(params.totalCad) }])}
      ${emailNote(
        'Refunds usually appear in 5–10 business days, depending on your bank. This order was cancelled before the carrier scanned the parcel (or before pickup was completed).'
      )}
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
      ${emailEyebrow('Marketplace dispute')}
      ${emailTitle('Chargeback opened')}
      ${emailLead(`A Stripe dispute was opened for ${emailStrong(params.productTitle)}.`)}
      ${emailDetails([
        { label: 'Amount', valueHtml: emailMoney(params.amountCad) },
        { label: 'Reason', valueHtml: escapeHtml(params.reason ?? '—') },
        { label: 'Dispute ID', valueHtml: emailCode(params.disputeId) },
      ])}
      ${emailNote(
        'Please gather evidence (label, tracking, packing/pickup proof) and respond in Stripe. Lost disputes are clawed back from your Connect balance per our Service Terms.'
      )}
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
      ${emailEyebrow('Marketplace dispute')}
      ${emailTitle('Dispute lost')}
      ${emailLead(
        `The dispute for ${emailStrong(params.productTitle)} was lost. Clawback amount: ${emailMoney(params.amountCad)} (includes Stripe dispute fee where applicable).`
      )}
      ${emailNote(
        params.clawbackOk
          ? 'The amount was debited from your Connect balance.'
          : 'Automatic clawback could not complete — offhrs will follow up or retry.'
      )}
    `)
  )
}

export async function sendShopDisputeWon(params: { to: string; productTitle: string }) {
  await send(
    params.to,
    `Marketplace dispute won: ${params.productTitle}`,
    wrap(`
      ${emailEyebrow('Marketplace dispute')}
      ${emailTitle('Dispute won')}
      ${emailLead(
        `Good news — the dispute for ${emailStrong(params.productTitle)} was won. No clawback is due for this dispute.`
      )}
    `)
  )
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

  const detailsJson = opts.details
    ? `<pre style="margin:0 0 16px;padding:14px 16px;background:#EDF2ED;border:1px solid #E5E2DC;font-size:12px;overflow:auto;color:#2D302B;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${escapeHtml(
        JSON.stringify(opts.details, null, 2)
      )}</pre>`
    : ''

  await send(
    recipients,
    `[offhrs ${opts.severity.toUpperCase()}] ${opts.eventType}`,
    wrap(`
      ${emailEyebrow(opts.severity === 'critical' ? 'Critical security' : 'Security warning')}
      ${emailTitle(escapeHtml(opts.eventType))}
      ${emailLead('A security event was recorded on the offhrs API.')}
      ${emailDetails([
        { label: 'Time', valueHtml: escapeHtml(opts.ts ?? new Date().toISOString()) },
        { label: 'Route', valueHtml: escapeHtml(opts.route ?? '—') },
        { label: 'IP key', valueHtml: escapeHtml(opts.ipKey ?? '—') },
      ])}
      ${detailsJson}
      ${emailNote('Check Vercel logs for <code>[SECURITY_EVENT]</code> and the <code>security_events</code> table in Supabase.')}
    `)
  )
}
