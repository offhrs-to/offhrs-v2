/**
 * Renders sample transactional emails to docs/email-previews/*.html
 * Run: node scripts/generate-email-previews.mjs
 */
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'docs', 'email-previews')

const CREAM = '#F2F1ED'
const PAPER = '#FFFFFF'
const INK = '#2D302B'
const MUTED = '#6B6E68'
const RULE = '#E5E2DC'
const ACCENT = '#5D755D'
const ACCENT_SOFT = '#EDF2ED'
const EMAIL_LOGO_URL = 'https://offhrs.app/logo.png'
const FONT_SANS =
  "'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,'Inter',sans-serif"

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrapEmailHtml(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>offhrs email preview</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};color:${INK};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${PAPER};border:1px solid ${RULE};">
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid ${RULE};">
              <img src="${EMAIL_LOGO_URL}" alt="offhrs" width="120" height="31" style="display:block;height:31px;width:auto;max-width:140px;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 40px;font-family:${FONT_SANS};">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid ${RULE};background:${CREAM};font-family:${FONT_SANS};">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};">offhrs</p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};">
                Toronto, ON ·
                <a href="https://offhrs.app" style="color:${ACCENT};text-decoration:none;">offhrs.app</a>
                ·
                <a href="mailto:hello@offhrs.app" style="color:${ACCENT};text-decoration:none;">hello@offhrs.app</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function emailEyebrow(text) {
  return `<p style="margin:0 0 12px;font-family:${FONT_SANS};font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${ACCENT};">${escapeHtml(text)}</p>`
}
function emailTitle(text) {
  return `<h1 style="margin:0 0 16px;font-family:${FONT_SANS};font-size:26px;font-weight:700;line-height:1.25;letter-spacing:-0.02em;color:${INK};">${text}</h1>`
}
function emailLead(html) {
  return `<p style="margin:0 0 24px;font-family:${FONT_SANS};font-size:15px;line-height:1.65;color:${MUTED};">${html}</p>`
}
function emailNote(html) {
  return `<p style="margin:0 0 20px;font-family:${FONT_SANS};font-size:14px;line-height:1.6;color:${MUTED};">${html}</p>`
}
function emailButton(href, label, tone = 'primary') {
  const bg = tone === 'danger' ? '#B85C5C' : ACCENT
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
  <tr><td style="border-radius:999px;background:${bg};">
    <a href="${href}" style="display:inline-block;padding:12px 28px;font-family:${FONT_SANS};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
  </td></tr></table>`
}
function emailStrong(text) {
  return `<strong style="color:${INK};font-weight:600;">${escapeHtml(text)}</strong>`
}
function emailMoney(n) {
  return `<span style="color:${ACCENT};font-weight:600;">$${Math.max(0, n).toFixed(2)} CAD</span>`
}
function emailCode(text) {
  return `<code style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;color:${INK};">${escapeHtml(text)}</code>`
}
function emailDetails(rows) {
  const inner = rows
    .map(
      (row, i) => `<tr>
      <td style="padding:${i === 0 ? '0' : '12px'} 0 ${i === rows.length - 1 ? '0' : '12px'};border-bottom:${i === rows.length - 1 ? '0' : `1px solid ${RULE}`};font-family:${FONT_SANS};font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED};width:38%;vertical-align:top;">${escapeHtml(row.label)}</td>
      <td style="padding:${i === 0 ? '0' : '12px'} 0 ${i === rows.length - 1 ? '0' : '12px'};border-bottom:${i === rows.length - 1 ? '0' : `1px solid ${RULE}`};font-family:${FONT_SANS};font-size:14px;line-height:1.5;color:${INK};vertical-align:top;">${row.valueHtml}</td>
    </tr>`
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;background:${ACCENT_SOFT};border:1px solid ${RULE};">
  <tr><td style="padding:20px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${inner}</table></td></tr>
</table>`
}

const samples = [
  {
    file: '01-marketplace-buyer-order.html',
    title: 'Marketplace · Buyer order confirmation',
    html: wrapEmailHtml(`
      ${emailEyebrow('Marketplace order')}
      ${emailTitle('Order confirmed')}
      ${emailLead(`Hi Alex, thanks for your purchase from ${emailStrong('Studio North')} on the offhrs Artist Marketplace.`)}
      ${emailDetails([
        { label: 'Order ID', valueHtml: emailCode('ord_demo_123') },
        { label: 'Order date', valueHtml: 'November 2, 2026' },
        { label: 'Seller', valueHtml: `<strong style="color:${INK};">Studio North</strong>` },
        { label: 'Item', valueHtml: `<strong style="color:${INK};">Ceramic mug — sand glaze</strong>` },
        { label: 'Item price', valueHtml: emailMoney(48) },
        { label: 'Shipping', valueHtml: emailMoney(12.5) },
        { label: 'Tax', valueHtml: emailMoney(7.87) },
        { label: 'Total paid', valueHtml: emailMoney(68.37) },
        { label: 'Delivery', valueHtml: 'Ships within Canada via Canada Post. Seller ships within 5 business days of payment.' },
        { label: 'Cancel / returns', valueHtml: 'Cancel in Profile → Orders before carrier First Scan for a full refund.' },
      ])}
      ${emailNote('View this order anytime in the offhrs app under Profile → Orders.')}
    `),
  },
  {
    file: '02-marketplace-seller-new-order.html',
    title: 'Marketplace · Seller new order',
    html: wrapEmailHtml(`
      ${emailEyebrow('Marketplace')}
      ${emailTitle('New Marketplace order')}
      ${emailLead(`${emailStrong('Alex Kim')} purchased ${emailStrong('Ceramic mug — sand glaze')}.`)}
      ${emailDetails([
        { label: 'Total paid', valueHtml: emailMoney(68.37) },
        { label: 'Fulfillment', valueHtml: 'Ship' },
      ])}
      ${emailNote('Print a Canada Post label in Marketplace → Orders. Ship within 5 business days.')}
      ${emailButton('https://offhrs.app/partners/dashboard/marketplace?tab=orders', 'Open orders')}
    `),
  },
  {
    file: '03-marketplace-buyer-shipped.html',
    title: 'Marketplace · Buyer shipped',
    html: wrapEmailHtml(`
      ${emailEyebrow('Marketplace shipping')}
      ${emailTitle('Your order is on the way')}
      ${emailLead(`Hi Alex, ${emailStrong('Ceramic mug — sand glaze')} has been scanned by Canada Post.`)}
      ${emailDetails([{ label: 'Tracking', valueHtml: '1234567890123456' }])}
      ${emailButton('https://www.canadapost.ca', 'Track package')}
    `),
  },
  {
    file: '04-marketplace-buyer-cancel.html',
    title: 'Marketplace · Buyer cancellation confirmed',
    html: wrapEmailHtml(`
      ${emailEyebrow('Marketplace cancellation')}
      ${emailTitle('Cancellation confirmed')}
      ${emailLead(`Hi Alex, your cancellation for ${emailStrong('Ceramic mug — sand glaze')} is confirmed. We&apos;ve refunded ${emailMoney(68.37)} to your original payment method.`)}
      ${emailDetails([{ label: 'Refund', valueHtml: emailMoney(68.37) }])}
      ${emailNote('Refunds usually appear in 5–10 business days, depending on your bank. This order was cancelled before the carrier scanned the parcel (or before pickup was completed).')}
    `),
  },
  {
    file: '05-marketplace-seller-buyer-cancelled.html',
    title: 'Marketplace · Seller — buyer cancelled',
    html: wrapEmailHtml(`
      ${emailEyebrow('Marketplace cancellation')}
      ${emailTitle('Buyer cancelled order')}
      ${emailLead(`${emailStrong('Alex Kim')} cancelled their order for ${emailStrong('Ceramic mug — sand glaze')} before carrier First Scan. A full refund was issued automatically.`)}
      ${emailDetails([
        { label: 'Refunded to buyer', valueHtml: emailMoney(68.37) },
        { label: 'Stripe fee', valueHtml: emailMoney(2.28) },
      ])}
      ${emailNote(`The Stripe processing fee of ${emailMoney(2.28)} on the original transaction is non-refundable by Stripe and remains your responsibility under the offhrs Service Terms.`)}
      ${emailButton('https://offhrs.app/partners/dashboard/marketplace', 'View Marketplace orders')}
    `),
  },
  {
    file: '06-marketplace-buyer-refund.html',
    title: 'Marketplace · Buyer refund (seller-initiated)',
    html: wrapEmailHtml(`
      ${emailEyebrow('Marketplace refund')}
      ${emailTitle('Refund issued')}
      ${emailLead(`Hi Alex, your order for ${emailStrong('Ceramic mug — sand glaze')} has been refunded (${emailMoney(68.37)}).`)}
      ${emailDetails([{ label: 'Refund', valueHtml: emailMoney(68.37) }])}
      ${emailNote('Refunds usually appear in 5–10 business days, depending on your bank.')}
    `),
  },
  {
    file: '07-workshop-buyer-confirmation.html',
    title: 'Workshop · Attendee confirmation',
    html: wrapEmailHtml(`
      ${emailEyebrow('Workshop confirmation')}
      ${emailTitle("You're booked")}
      ${emailLead(`Hi Jordan, you&apos;re all set for ${emailStrong('Intro to Wheel Throwing')} with Studio North.`)}
      ${emailDetails([
        { label: 'Session', valueHtml: 'Intro to Wheel Throwing' },
        { label: 'Host', valueHtml: 'Studio North' },
        { label: 'Date', valueHtml: 'Saturday, November 15, 2026 at 2:00 PM EST' },
        { label: 'Location', valueHtml: '1 Dundas St E, Toronto, ON' },
        { label: 'Amount paid', valueHtml: emailMoney(85) },
        { label: 'Booking ref', valueHtml: emailCode('bk_demo_456') },
      ])}
      ${emailNote('<strong style="color:#2D302B;">Cancellation policy:</strong> Full refund up to 24 hours before the session starts.')}
      ${emailNote('A calendar invite is attached. See you there.')}
    `),
  },
  {
    file: '08-workshop-seller-new-booking.html',
    title: 'Workshop · Host new booking',
    html: wrapEmailHtml(`
      ${emailEyebrow('Workshop')}
      ${emailTitle('New booking received')}
      ${emailLead(`${emailStrong('Jordan Lee')} (jordan@example.com) just booked ${emailStrong('Intro to Wheel Throwing')}.`)}
      ${emailDetails([
        { label: 'Session', valueHtml: 'Intro to Wheel Throwing' },
        { label: 'Date', valueHtml: 'Sat, Nov 15, 2:00 PM' },
        { label: 'Amount', valueHtml: emailMoney(85) },
      ])}
      ${emailButton('https://offhrs.app/partners/dashboard/bookings', 'View in dashboard')}
    `),
  },
  {
    file: '09-workshop-buyer-refund.html',
    title: 'Workshop · Attendee refund',
    html: wrapEmailHtml(`
      ${emailEyebrow('Workshop refund')}
      ${emailTitle('Refund issued')}
      ${emailLead(`Hi Jordan, your booking for ${emailStrong('Intro to Wheel Throwing')} has been cancelled and a refund of ${emailMoney(85)} has been issued to your original payment method.`)}
      ${emailDetails([
        { label: 'Refund', valueHtml: emailMoney(85) },
        { label: 'Booking ref', valueHtml: emailCode('bk_demo_456') },
      ])}
      ${emailNote('Refunds typically appear on your card within 5–10 business days.')}
    `),
  },
  {
    file: '10-workshop-seller-refund.html',
    title: 'Workshop · Host booking refunded',
    html: wrapEmailHtml(`
      ${emailEyebrow('Workshop refund')}
      ${emailTitle('Booking refunded')}
      ${emailLead(`<strong style="color:${INK};">Jordan Lee (jordan@example.com)</strong>&apos;s booking for ${emailStrong('Intro to Wheel Throwing')} was refunded.`)}
      ${emailDetails([
        { label: 'Refunded to client', valueHtml: emailMoney(85) },
        { label: 'Stripe fee', valueHtml: emailMoney(2.77) },
      ])}
      ${emailNote(`The Stripe processing fee of ${emailMoney(2.77)} on the original transaction is non-refundable by Stripe and remains your responsibility under the offhrs Service Terms.`)}
      ${emailButton('https://offhrs.app/partners/dashboard/bookings', 'View booking')}
    `),
  },
  {
    file: '11-partners-verify-email.html',
    title: 'Partners · Verify email',
    html: wrapEmailHtml(`
      ${emailEyebrow('Partners')}
      ${emailTitle('Welcome, Studio North')}
      ${emailLead('Click the button below to verify your email address and continue setting up your account.')}
      ${emailNote('Once you&apos;re in the dashboard: if you&apos;re GST/HST-registered with the CRA, enable <strong style="color:#2D302B;">Settings → Workshop sales tax</strong> before your first paid booking.')}
      ${emailButton('https://offhrs.app/partners/verify-email', 'Verify email')}
      ${emailNote('If you didn&apos;t sign up for offhrs Partners, you can safely ignore this email.')}
    `),
  },
]

mkdirSync(outDir, { recursive: true })

const cards = samples
  .map(
    (s) => `<a class="card" href="./${s.file}">
  <span class="label">${escapeHtml(s.title)}</span>
  <span class="open">Open preview →</span>
</a>`
  )
  .join('\n')

const index = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>offhrs email previews</title>
<style>
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; background:${CREAM}; color:${INK}; }
  main { max-width:720px; margin:0 auto; padding:48px 20px 80px; }
  h1 { font-family:${FONT_SANS}; font-weight:700; font-size:28px; letter-spacing:-0.02em; margin:0 0 8px; }
  .sub { color:${MUTED}; font-size:14px; line-height:1.6; margin:0 0 32px; }
  .grid { display:grid; gap:10px; }
  .card { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:16px 18px; background:${PAPER}; border:1px solid ${RULE}; text-decoration:none; color:${INK}; }
  .card:hover { border-color:${ACCENT}; }
  .label { font-size:14px; font-weight:600; }
  .open { font-size:13px; color:${ACCENT}; white-space:nowrap; }
</style>
</head>
<body>
<main>
  <h1>Email previews</h1>
  <p class="sub">Sample renders of the redesigned offhrs transactional emails. No orders required — open any card.</p>
  <div class="grid">
${cards}
  </div>
</main>
</body>
</html>`

writeFileSync(join(outDir, 'index.html'), index)
for (const s of samples) {
  writeFileSync(join(outDir, s.file), s.html)
}

console.log(`Wrote ${samples.length + 1} files to ${outDir}`)
