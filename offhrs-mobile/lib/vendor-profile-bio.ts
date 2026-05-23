import { BOOK_API_BASE } from '@/constants/api';
import { buildBookingApiHeaders } from '@/lib/booking-api-headers';
import { supabase } from '@/lib/supabase';

const ACTIVE_VENDOR_STATUSES = ['trialing', 'active', 'past_due'] as const;

type EventBioHint = {
  vendor_profile_id?: string | null;
  organizer?: string | null;
};

async function fetchBioByProfileId(profileId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('bio')
    .eq('id', profileId)
    .in('status', [...ACTIVE_VENDOR_STATUSES])
    .maybeSingle();
  if (error) return null;
  return data?.bio?.trim() || null;
}

async function fetchBioByBusinessName(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('bio')
    .ilike('business_name', trimmed)
    .in('status', [...ACTIVE_VENDOR_STATUSES])
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data?.bio?.trim() || null;
}

async function fetchBioBySlug(slug: string): Promise<string | null> {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('bio')
    .eq('slug', trimmed)
    .in('status', [...ACTIVE_VENDOR_STATUSES])
    .maybeSingle();
  if (error) return null;
  return data?.bio?.trim() || null;
}

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Resolve partner bio for a legacy `/vendors/[id]` page (vendors table id + linked events).
 */
export async function resolveVendorProfileBio(params: {
  legacyVendorId: string;
  vendorProfileIdParam?: string | null;
  vendorName?: string | null;
  vendorSlug?: string | null;
  events: EventBioHint[];
  accessToken?: string | null;
}): Promise<string | null> {
  const profileIdParam = params.vendorProfileIdParam?.trim();
  if (profileIdParam) {
    const fromParam = await fetchBioByProfileId(profileIdParam);
    if (fromParam) return fromParam;
  }

  for (const row of params.events) {
    const pid = row.vendor_profile_id?.trim();
    if (pid) {
      const fromEvent = await fetchBioByProfileId(pid);
      if (fromEvent) return fromEvent;
    }
  }

  if (params.vendorSlug?.trim()) {
    const fromSlug = await fetchBioBySlug(params.vendorSlug);
    if (fromSlug) return fromSlug;
  }

  const names = new Set<string>();
  if (params.vendorName?.trim()) names.add(params.vendorName.trim());
  for (const row of params.events) {
    if (row.organizer?.trim()) names.add(row.organizer.trim());
  }

  for (const name of names) {
    const fromName = await fetchBioByBusinessName(name);
    if (fromName) return fromName;
    const fromDerivedSlug = await fetchBioBySlug(slugFromName(name));
    if (fromDerivedSlug) return fromDerivedSlug;
  }

  const q = new URLSearchParams();
  if (profileIdParam) q.set('vendorProfileId', profileIdParam);
  try {
    const headers = await buildBookingApiHeaders(params.accessToken ?? undefined);
    const res = await fetch(
      `${BOOK_API_BASE}/api/vendors/${encodeURIComponent(params.legacyVendorId)}/profile?${q.toString()}`,
      { headers }
    );
    if (res.ok) {
      const body = (await res.json()) as { bio?: string | null };
      const fromApi = body.bio?.trim();
      if (fromApi) return fromApi;
    }
  } catch {
    // Direct Supabase read is enough when RLS allows public vendor_profiles SELECT.
  }

  return null;
}
