/**
 * Shared HTML template for workshop booking / confirmation emails sent via Resend.
 * Edit this file to change how the email looks. Variables are passed in and escaped for HTML.
 */
export type WorkshopEmailParams = {
  eventName: string
  confirmUrl: string
  /** Optional: "You're booked" vs "Confirm your attendance" */
  headline?: string
  /** Optional: short line before the CTA */
  bodyLine?: string
  /** Optional: CTA button text */
  ctaText?: string
}

const escape = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export function getWorkshopConfirmationHtml(params: WorkshopEmailParams): string {
  const {
    eventName,
    confirmUrl,
    headline = "You're booked",
    bodyLine = 'After attending, confirm your attendance to earn experience points.',
    ctaText = 'Confirm I attended',
  } = params

  const safeName = escape(eventName)
  const safeHeadline = escape(headline)
  const safeBody = escape(bodyLine)
  const safeCta = escape(ctaText)

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workshop confirmation – Offhrs</title>
</head>
<body style="margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
    <div style="background: #38511B; padding: 24px 24px 20px; text-align: center;">
      <span style="color: #fff; font-size: 22px; font-weight: 700; letter-spacing: -0.02em;">offhrs</span>
    </div>
    <div style="padding: 28px 24px 32px;">
      <h1 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #2C2C2C;">${safeHeadline}</h1>
      <p style="margin: 0 0 20px; font-size: 16px; color: #2C2C2C; line-height: 1.5;">
        <strong>${safeName}</strong>
      </p>
      <p style="margin: 0 0 24px; font-size: 15px; color: #6B6B6B; line-height: 1.5;">
        ${safeBody}
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${confirmUrl}" style="display: inline-block; padding: 14px 28px; background: #38511B; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 9999px;">
          ${safeCta}
        </a>
      </p>
      <p style="margin: 0; font-size: 13px; color: #9ca3af;">
        This link is for your use only and expires when used.
      </p>
    </div>
    <div style="padding: 16px 24px; border-top: 1px solid #E5E7EB; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        You received this because you booked a workshop on Offhrs.
      </p>
    </div>
  </div>
</body>
</html>
`.trim()
}
