/**
 * Shared transactional email shell — editorial, O'sric-inspired cleanliness
 * adapted to offhrs (cream ground, ink type, soft sage accent).
 */

/** Official wordmark — always from production so preview deploys render in inboxes. */
export const EMAIL_LOGO_URL = 'https://offhrs.app/logo.png'

const CREAM = '#F2F1ED'
const PAPER = '#FFFFFF'
const INK = '#2D302B'
const MUTED = '#6B6E68'
const RULE = '#E5E2DC'
const ACCENT = '#5D755D'
const ACCENT_SOFT = '#EDF2ED'

/** Matches offhrs web UI (`SF Pro Display` → system → Inter), not O'sric serif. */
const FONT_SANS =
  "'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,'Inter',sans-serif"

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Full HTML document wrapper. */
export function wrapEmailHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>offhrs</title>
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
</html>`.trim()
}

/** Small caps eyebrow above the title. */
export function emailEyebrow(text: string): string {
  return `<p style="margin:0 0 12px;font-family:${FONT_SANS};font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${ACCENT};">${escapeHtml(text)}</p>`
}

export function emailTitle(text: string): string {
  return `<h1 style="margin:0 0 16px;font-family:${FONT_SANS};font-size:26px;font-weight:700;line-height:1.25;letter-spacing:-0.02em;color:${INK};">${text}</h1>`
}

export function emailLead(html: string): string {
  return `<p style="margin:0 0 24px;font-family:${FONT_SANS};font-size:15px;line-height:1.65;color:${MUTED};">${html}</p>`
}

export function emailNote(html: string): string {
  return `<p style="margin:0 0 20px;font-family:${FONT_SANS};font-size:14px;line-height:1.6;color:${MUTED};">${html}</p>`
}

export function emailButton(href: string, label: string, tone: 'primary' | 'danger' = 'primary'): string {
  const bg = tone === 'danger' ? '#B85C5C' : ACCENT
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
  <tr>
    <td style="border-radius:999px;background:${bg};">
      <a href="${href}" style="display:inline-block;padding:12px 28px;font-family:${FONT_SANS};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`
}

export type EmailDetailRow = { label: string; valueHtml: string }

/** Soft cream detail card — label / value rows. */
export function emailDetails(rows: EmailDetailRow[]): string {
  const inner = rows
    .map(
      (row, i) => `<tr>
      <td style="padding:${i === 0 ? '0' : '12px'} 0 ${i === rows.length - 1 ? '0' : '12px'};border-bottom:${i === rows.length - 1 ? '0' : `1px solid ${RULE}`};font-family:${FONT_SANS};font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED};width:38%;vertical-align:top;">${escapeHtml(row.label)}</td>
      <td style="padding:${i === 0 ? '0' : '12px'} 0 ${i === rows.length - 1 ? '0' : '12px'};border-bottom:${i === rows.length - 1 ? '0' : `1px solid ${RULE}`};font-family:${FONT_SANS};font-size:14px;line-height:1.5;color:${INK};vertical-align:top;">${row.valueHtml}</td>
    </tr>`
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;background:${ACCENT_SOFT};border:1px solid ${RULE};">
  <tr>
    <td style="padding:20px 22px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${inner}</table>
    </td>
  </tr>
</table>`
}

export function emailStrong(text: string): string {
  return `<strong style="color:${INK};font-weight:600;">${escapeHtml(text)}</strong>`
}

export function emailMoney(amountCad: number): string {
  return `<span style="color:${ACCENT};font-weight:600;">$${Math.max(0, amountCad).toFixed(2)} CAD</span>`
}

export function emailCode(text: string): string {
  return `<code style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;color:${INK};">${escapeHtml(text)}</code>`
}
