import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { logSecurityEvent } from '@/lib/security-monitor'
import { NextRequest, NextResponse } from 'next/server'

const LIMIT = 30 // per minute per IP — reporting endpoint only

/**
 * Client reports a failed partner password login so we can detect stuffing.
 * Does not reveal whether the email exists.
 */
export async function POST(request: NextRequest) {
  const ipKey = getRateLimitKey(request)
  const rl = consumeRateLimit(`partner-login-failed:${ipKey}`, LIMIT)
  if (!rl.allowed) {
    logSecurityEvent('warn', {
      type: 'rate_limited',
      route: '/api/partners/auth/login-failed',
      ipKey,
    })
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  let emailDomain: string | null = null
  try {
    const body = (await request.json()) as { email?: unknown }
    if (typeof body.email === 'string' && body.email.includes('@')) {
      emailDomain = body.email.split('@')[1]?.toLowerCase() ?? null
    }
  } catch {
    // ignore bad body
  }

  logSecurityEvent('warn', {
    type: 'partner_login_failed',
    route: '/partners/login',
    ipKey,
    details: emailDomain ? { emailDomain } : undefined,
  })

  // Escalate after many failures from same IP in this process window.
  const burstKey = `partner-login-burst:${ipKey}`
  const burst = consumeRateLimit(burstKey, 12) // 12 failures / minute → alert once via below
  if (!burst.allowed) {
    logSecurityEvent('warn', {
      type: 'partner_login_failed_burst',
      route: '/partners/login',
      ipKey,
      details: emailDomain ? { emailDomain } : undefined,
    })
  }

  return NextResponse.json({ ok: true })
}
