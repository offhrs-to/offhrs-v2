import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CURRENT_POLICY_VERSION,
  PARTNER_CLICKWRAP_DOCS,
  type PartnerClickwrapDoc,
} from '@/lib/legal-acceptances-client'

export {
  CURRENT_POLICY_VERSION,
  PARTNER_CLICKWRAP_DOCS,
  PARTNER_CLICKWRAP_LINKS,
  type PartnerClickwrapDoc,
} from '@/lib/legal-acceptances-client'

export type LegalAcceptanceContext =
  | 'partner_signup'
  | 'partner_reaccept'
  | 'marketplace_shipping'
  | 'shopify_connect'

export function clientIpFromRequest(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first.slice(0, 128)
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  return realIp ? realIp.slice(0, 128) : null
}

export function userAgentFromRequest(request: Request): string | null {
  const ua = request.headers.get('user-agent')?.trim()
  return ua ? ua.slice(0, 512) : null
}

export async function vendorHasCurrentPartnerTermsAcceptance(
  admin: SupabaseClient,
  userId: string,
  version: string = CURRENT_POLICY_VERSION
): Promise<boolean> {
  const { data, error } = await admin
    .from('legal_acceptances')
    .select('document_key')
    .eq('user_id', userId)
    .eq('document_version', version)
    .in('document_key', [...PARTNER_CLICKWRAP_DOCS])

  if (error) {
    // Table missing on an old DB — fail open for dashboard so deploys aren't blocked;
    // signup/re-accept APIs still require the table once migrated.
    if (error.code === 'PGRST205' || (error.message ?? '').toLowerCase().includes('does not exist')) {
      console.warn('legal_acceptances missing; skipping terms gate', error.message)
      return true
    }
    console.error('legal_acceptances status check failed', error.message)
    return false
  }

  const have = new Set((data ?? []).map((r) => r.document_key as string))
  return PARTNER_CLICKWRAP_DOCS.every((doc) => have.has(doc))
}

export async function recordPartnerClickwrapAcceptances(params: {
  admin: SupabaseClient
  userId: string
  vendorId?: string | null
  context: LegalAcceptanceContext
  ipAddress?: string | null
  userAgent?: string | null
  /** Subset of docs; default = full partner bundle. */
  documents?: readonly PartnerClickwrapDoc[]
  version?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const docs = params.documents ?? PARTNER_CLICKWRAP_DOCS
  const version = params.version ?? CURRENT_POLICY_VERSION
  const rows = docs.map((document_key) => ({
    user_id: params.userId,
    vendor_id: params.vendorId ?? null,
    document_key,
    document_version: version,
    context: params.context,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
  }))

  const { error } = await params.admin.from('legal_acceptances').insert(rows)
  if (error) {
    console.error('legal_acceptances insert failed', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/** Marketplace shipping attestation — persist Seller Addendum version. */
export async function recordMarketplaceSellerAddendumAcceptance(params: {
  admin: SupabaseClient
  userId: string
  vendorId: string
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return recordPartnerClickwrapAcceptances({
    ...params,
    context: 'marketplace_shipping',
    documents: ['marketplace-seller-addendum'],
  })
}
