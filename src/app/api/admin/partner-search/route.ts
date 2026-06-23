import { verifyAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export type AdminPartnerSearchRow = {
  key: string
  label: string
  vendorProfileId: string | null
  legacyVendorId: string | null
  locationAddress: string | null
  status: string | null
  source: 'partner' | 'legacy'
}

/**
 * GET /api/admin/partner-search?q=...
 * Search SaaS partners (vendor_profiles) and legacy marketplace vendors by name.
 */
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) {
    return NextResponse.json({ results: [] as AdminPartnerSearchRow[] })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const pattern = `%${q.replace(/%/g, '\\%')}%`

  const [{ data: partners }, { data: legacy }] = await Promise.all([
    admin
      .from('vendor_profiles')
      .select('id, business_name, location_address, status')
      .ilike('business_name', pattern)
      .order('business_name', { ascending: true })
      .limit(20),
    admin
      .from('vendors')
      .select('id, name')
      .ilike('name', pattern)
      .order('name', { ascending: true })
      .limit(20),
  ])

  const results: AdminPartnerSearchRow[] = []
  const seenLabels = new Set<string>()

  for (const p of partners ?? []) {
    const label = (p.business_name ?? '').trim()
    if (!label) continue
    const norm = label.toLowerCase()
    if (seenLabels.has(norm)) continue
    seenLabels.add(norm)
    results.push({
      key: `partner:${p.id}`,
      label,
      vendorProfileId: p.id,
      legacyVendorId: null,
      locationAddress: (p.location_address ?? '').trim() || null,
      status: p.status ?? null,
      source: 'partner',
    })
  }

  for (const v of legacy ?? []) {
    const label = (v.name ?? '').trim()
    if (!label) continue
    const norm = label.toLowerCase()
    if (seenLabels.has(norm)) continue
    seenLabels.add(norm)
    results.push({
      key: `legacy:${v.id}`,
      label,
      vendorProfileId: null,
      legacyVendorId: v.id,
      locationAddress: null,
      status: null,
      source: 'legacy',
    })
  }

  return NextResponse.json({ results: results.slice(0, 25) })
}
