import 'server-only'

/**
 * Platform Shippo client scaffolding (Phase 0).
 * Rates, label purchase, void, and tracking land in Phases 2–3.
 *
 * Setup (ops):
 * 1. Create a Shippo account and enable Canada Post.
 * 2. Use API keys (test then live). Prefer API Starter pricing.
 * 3. Fund the account / attach a card for postage + per-label fees.
 * 4. Set SHIPPO_API_KEY in Vercel env (never expose to the client).
 */

export function shippoApiKey(): string | null {
  const key = process.env.SHIPPO_API_KEY?.trim()
  return key || null
}

export function isShippoConfigured(): boolean {
  return Boolean(shippoApiKey())
}

export type ShippoConfigStatus = {
  configured: boolean
  /** Safe for logs / admin — never returns the key. */
  hint: string
}

export function getShippoConfigStatus(): ShippoConfigStatus {
  if (!isShippoConfigured()) {
    return {
      configured: false,
      hint: 'SHIPPO_API_KEY is not set. Create a Shippo account and add the key before Phase 2 checkout.',
    }
  }
  return {
    configured: true,
    hint: 'SHIPPO_API_KEY is set (platform account). Verify Canada Post is enabled in Shippo.',
  }
}

/** Placeholder — implement with Shippo REST in Phase 2. */
export async function shippoNotImplemented(operation: string): Promise<never> {
  throw new Error(
    `Shippo ${operation} is not implemented yet (Phase 2+). Configured=${isShippoConfigured()}`
  )
}
