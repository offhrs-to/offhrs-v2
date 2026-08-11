import { createAdminClient } from '@/lib/supabase/admin'
import { sendSecurityAlertEmail } from '@/lib/emails'

type SecuritySeverity = 'info' | 'warn' | 'critical'

type SecurityEvent = {
  type: string
  route?: string
  ipKey?: string
  userId?: string | null
  details?: Record<string, unknown>
}

/** Warn types that always page ops (debounced). */
const ALERT_WARN_TYPES = new Set([
  'admin_login_failed',
  'daily_quota_exceeded',
  'partner_login_failed_burst',
])

/** Rate-limit hits before escalating one alert (per route+ip, per process). */
const RATE_LIMIT_BURST_THRESHOLD = 25
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000

const lastAlertAt = new Map<string, number>()
const rateLimitHits = new Map<string, { count: number; windowStart: number }>()

function alertDebounceMs(severity: SecuritySeverity): number {
  return severity === 'critical' ? 5 * 60 * 1000 : 15 * 60 * 1000
}

function securityAlertRecipients(): string[] {
  const raw =
    process.env.SECURITY_ALERT_EMAIL?.trim() ||
    process.env.SECURITY_ALERT_TO?.trim() ||
    'hello@offhrs.app'
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function shouldDebounce(key: string, severity: SecuritySeverity): boolean {
  const now = Date.now()
  const prev = lastAlertAt.get(key) ?? 0
  if (now - prev < alertDebounceMs(severity)) return true
  lastAlertAt.set(key, now)
  return false
}

function noteRateLimitBurst(event: SecurityEvent): boolean {
  if (event.type !== 'rate_limited') return false
  const key = `${event.route ?? 'unknown'}:${event.ipKey ?? 'unknown'}`
  const now = Date.now()
  const cur = rateLimitHits.get(key)
  if (!cur || now - cur.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitHits.set(key, { count: 1, windowStart: now })
    return false
  }
  cur.count += 1
  return cur.count === RATE_LIMIT_BURST_THRESHOLD
}

async function postSecurityWebhook(payload: Record<string, unknown>): Promise<void> {
  const url = process.env.SECURITY_ALERT_WEBHOOK_URL?.trim()
  if (!url) return
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

function dispatchSecurityAlert(
  severity: 'warn' | 'critical',
  event: SecurityEvent,
  ts: string
): void {
  if (process.env.SECURITY_ALERTS_DISABLED === '1') return

  const alertKey = `${severity}:${event.type}:${event.route ?? ''}`
  if (shouldDebounce(alertKey, severity)) return

  const recipients = securityAlertRecipients()
  const webhookPayload = {
    text: `[offhrs ${severity}] ${event.type}${event.route ? ` on ${event.route}` : ''}`,
    severity,
    ts,
    ...event,
  }

  void sendSecurityAlertEmail({
    to: recipients,
    severity,
    eventType: event.type,
    route: event.route,
    ipKey: event.ipKey,
    details: event.details ?? null,
    ts,
  }).catch((err) => {
    console.error('Security alert email failed:', err)
  })

  void postSecurityWebhook(webhookPayload).catch((err) => {
    console.error('Security alert webhook failed:', err)
  })
}

/**
 * Best-effort, non-blocking persistence of security events to the
 * `security_events` table so they survive redeploys/instance recycling and
 * are queryable later. Never throws and never delays the caller — failures
 * are swallowed (the console log above is always emitted regardless).
 */
function persistSecurityEvent(severity: SecuritySeverity, event: SecurityEvent): void {
  const admin = createAdminClient()
  if (!admin) return
  void admin
    .from('security_events')
    .insert({
      severity,
      event_type: event.type,
      route: event.route ?? null,
      ip_key: event.ipKey ?? null,
      user_id: event.userId ?? null,
      details: event.details ?? null,
    })
    .then(({ error }) => {
      if (error) console.error('Failed to persist security event:', error.message)
    })
}

/**
 * Log + persist a security event. Critical events (and selected warns / rate-limit
 * bursts) also email SECURITY_ALERT_EMAIL (default hello@offhrs.app) and optionally
 * POST to SECURITY_ALERT_WEBHOOK_URL (Slack/Discord-compatible JSON).
 *
 * Env:
 * - SECURITY_ALERT_EMAIL — comma-separated recipients (default hello@offhrs.app)
 * - SECURITY_ALERT_WEBHOOK_URL — optional incoming webhook
 * - SECURITY_ALERTS_DISABLED=1 — mute outbound alerts (logs/DB still write)
 */
export function logSecurityEvent(severity: SecuritySeverity, event: SecurityEvent): void {
  const payload = {
    ts: new Date().toISOString(),
    severity,
    ...event,
  }
  const message = `[SECURITY_EVENT] ${JSON.stringify(payload)}`
  if (severity === 'critical') {
    console.error(message)
  } else if (severity === 'warn') {
    console.warn(message)
  } else {
    console.log(message)
  }

  try {
    persistSecurityEvent(severity, event)
  } catch (err) {
    console.error('logSecurityEvent persistence threw:', err)
  }

  try {
    if (severity === 'critical') {
      dispatchSecurityAlert('critical', event, payload.ts)
      return
    }
    if (severity === 'warn' && ALERT_WARN_TYPES.has(event.type)) {
      dispatchSecurityAlert('warn', event, payload.ts)
      return
    }
    if (noteRateLimitBurst(event)) {
      dispatchSecurityAlert(
        'warn',
        {
          ...event,
          type: 'rate_limited_burst',
          details: {
            ...(event.details ?? {}),
            threshold: RATE_LIMIT_BURST_THRESHOLD,
            windowMinutes: RATE_LIMIT_WINDOW_MS / 60000,
          },
        },
        payload.ts
      )
    }
  } catch (err) {
    console.error('logSecurityEvent alert dispatch threw:', err)
  }
}
