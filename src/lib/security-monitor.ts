type SecuritySeverity = 'info' | 'warn' | 'critical'

type SecurityEvent = {
  type: string
  route?: string
  ipKey?: string
  userId?: string | null
  details?: Record<string, unknown>
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
    return
  }
  if (severity === 'warn') {
    console.warn(message)
    return
  }
  console.log(message)
}
