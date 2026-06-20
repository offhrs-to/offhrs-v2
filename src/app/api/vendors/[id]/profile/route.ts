import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const ACTIVE_STATUSES = ['trialing', 'active', 'past_due'] as const

/**
 * GET /api/vendors/[id]/profile
 * Public partner bio for mobile vendor pages (legacy vendors.id).
 * Query: vendorProfileId (optional SaaS profile uuid)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: legacyVendorId } = await params
  const vendorProfileId = request.nextUrl.searchParams.get('vendorProfileId')?.trim() || null

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  const { data: legacyVendor } = await admin
    .from('vendors')
    .select('id, name, slug')
    .eq('id', legacyVendorId)
    .maybeSingle()

  if (!legacyVendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
  }

  const tryProfile = async (profileId: string) => {
    const { data } = await admin
      .from('vendor_profiles')
      .select('id, business_name, bio, website_url')
      .eq('id', profileId)
      .in('status', [...ACTIVE_STATUSES])
      .maybeSingle()
    return data
  }

  const profilePayload = (vp: {
    id: string
    business_name: string | null
    bio: string | null
    website_url?: string | null
  }) => ({
    vendorProfileId: vp.id,
    businessName: vp.business_name,
    bio: vp.bio?.trim() || null,
    websiteUrl: vp.website_url?.trim() || null,
  })

  if (vendorProfileId) {
    const vp = await tryProfile(vendorProfileId)
    if (vp) {
      return NextResponse.json(profilePayload(vp))
    }
  }

  const { data: linkedEvents } = await admin
    .from('events')
    .select('vendor_profile_id, organizer')
    .eq('vendor_id', legacyVendorId)
    .not('vendor_profile_id', 'is', null)
    .limit(20)

  for (const row of linkedEvents ?? []) {
    const pid = row.vendor_profile_id as string | null
    if (!pid) continue
    const vp = await tryProfile(pid)
    if (vp) {
      return NextResponse.json(profilePayload(vp))
    }
  }

  const names = new Set<string>()
  if (legacyVendor.name?.trim()) names.add(legacyVendor.name.trim())
  for (const row of linkedEvents ?? []) {
    if (row.organizer?.trim()) names.add(row.organizer.trim())
  }

  for (const name of names) {
    const { data: vp } = await admin
      .from('vendor_profiles')
      .select('id, business_name, bio, website_url')
      .ilike('business_name', name)
      .in('status', [...ACTIVE_STATUSES])
      .limit(1)
      .maybeSingle()
    if (vp) {
      return NextResponse.json(profilePayload(vp))
    }
  }

  const slug = legacyVendor.slug?.trim().toLowerCase()
  if (slug) {
    const { data: vp } = await admin
      .from('vendor_profiles')
      .select('id, business_name, bio, website_url')
      .eq('slug', slug)
      .in('status', [...ACTIVE_STATUSES])
      .maybeSingle()
    if (vp) {
      return NextResponse.json(profilePayload(vp))
    }
  }

  return NextResponse.json({
    vendorProfileId: null,
    businessName: legacyVendor.name,
    bio: null,
    websiteUrl: null,
  })
}
