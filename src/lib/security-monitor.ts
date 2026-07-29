import { createAdminClient } from '@/lib/supabase/admin'

type SecuritySeverity = 'info' | 'warn' | 'critical'

type SecurityEvent = {
  type: string
  route?: string
  ipKey?: string
  userId?: string | null
  details?: Record<string, unknown>
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
}

