import { NextResponse } from 'next/server'
import { logSecurityEvent } from '@/lib/security-monitor'

/**
 * Emergency kill switch for expensive endpoints, per
 * docs/security/BANKRUPTCY_PREVENTION_RUNBOOK.md section 2.
 * Set DISABLE_EXPENSIVE_ENDPOINTS=1 to make covered routes return 503
 * immediately, without a redeploy, during a cost/abuse incident.
 */
export function isKillSwitchActive(): boolean {
  return process.env.DISABLE_EXPENSIVE_ENDPOINTS === '1'
}

export function killSwitchResponse(route: string): NextResponse {
  logSecurityEvent('critical', { type: 'kill_switch_active', route })
  return NextResponse.json({ error: 'Temporarily unavailable' }, { status: 503 })
}
