import { BOOK_API_BASE } from '@/constants/api';
import { buildBookingApiHeaders } from '@/lib/booking-api-headers';
import { supabase } from '@/lib/supabase';

const ACTIVE_VENDOR_STATUSES = ['trialing', 'active', 'past_due'] as const;

export type VendorPublicProfile = {
  bio: string | null;
  websiteUrl: string | null;
};

type EventBioHint = {
  vendor_profile_id?: string | null;
  organizer?: string | null;
};

type ProfileRow = {
  bio?: string | null;
  website_url?: string | null;
};

function mapProfileRow(row: ProfileRow | null | undefined): VendorPublicProfile {
  const bio = row?.bio?.trim() || null;
  const websiteUrl = row?.website_url?.trim() || null;
  return { bio, websiteUrl };
}

function hasProfileContent(profile: VendorPublicProfile): boolean {
  return profile.bio != null || profile.websiteUrl != null;
}

async function fetchProfileByProfileId(profileId: string): Promise<VendorPublicProfile | null> {
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('bio, website_url')
    .eq('id', profileId)
    .in('status', [...ACTIVE_VENDOR_STATUSES])
    .maybeSingle();
  if (error || !data) return null;
  const profile = mapProfileRow(data);
  return hasProfileContent(profile) ? profile : null;
}

async function fetchProfileByBusinessName(name: string): Promise<VendorPublicProfile | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('bio, website_url')
    .ilike('business_name', trimmed)
    .in('status', [...ACTIVE_VENDOR_STATUSES])
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const profile = mapProfileRow(data);
  return hasProfileContent(profile) ? profile : null;
}

async function fetchProfileBySlug(slug: string): Promise<VendorPublicProfile | null> {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('bio, website_url')
    .eq('slug', trimmed)
    .in('status', [...ACTIVE_VENDOR_STATUSES])
    .maybeSingle();
  if (error || !data) return null;
  const profile = mapProfileRow(data);
  return hasProfileContent(profile) ? profile : null;
}

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

function mergeProfiles(...profiles: (VendorPublicProfile | null | undefined)[]): VendorPublicProfile {
  let bio: string | null = null;
  let websiteUrl: string | null = null;
  for (const p of profiles) {
    if (!p) continue;
    if (!bio && p.bio) bio = p.bio;
    if (!websiteUrl && p.websiteUrl) websiteUrl = p.websiteUrl;
    if (bio && websiteUrl) break;
  }
  return { bio, websiteUrl };
}

/**
 * Resolve partner public profile fields for a legacy `/vendors/[id]` page.
 */
export async function resolveVendorPublicProfile(params: {
  legacyVendorId: string;
  vendorProfileIdParam?: string | null;
  vendorName?: string | null;
  vendorSlug?: string | null;
  events: EventBioHint[];
  accessToken?: string | null;
}): Promise<VendorPublicProfile> {
  const empty: VendorPublicProfile = { bio: null, websiteUrl: null };
  const found: VendorPublicProfile[] = [];

  const profileIdParam = params.vendorProfileIdParam?.trim();
  if (profileIdParam) {
    const fromParam = await fetchProfileByProfileId(profileIdParam);
    if (fromParam) found.push(fromParam);
  }

  for (const row of params.events) {
    const pid = row.vendor_profile_id?.trim();
    if (pid) {
      const fromEvent = await fetchProfileByProfileId(pid);
      if (fromEvent) found.push(fromEvent);
    }
  }

  if (params.vendorSlug?.trim()) {
    const fromSlug = await fetchProfileBySlug(params.vendorSlug);
    if (fromSlug) found.push(fromSlug);
  }

  const names = new Set<string>();
  if (params.vendorName?.trim()) names.add(params.vendorName.trim());
  for (const row of params.events) {
    if (row.organizer?.trim()) names.add(row.organizer.trim());
  }

  for (const name of names) {
    const fromName = await fetchProfileByBusinessName(name);
    if (fromName) found.push(fromName);
    const fromDerivedSlug = await fetchProfileBySlug(slugFromName(name));
    if (fromDerivedSlug) found.push(fromDerivedSlug);
  }

  const merged = mergeProfiles(...found);
  if (merged.bio || merged.websiteUrl) return merged;

  const q = new URLSearchParams();
  if (profileIdParam) q.set('vendorProfileId', profileIdParam);
  try {
    const headers = await buildBookingApiHeaders(params.accessToken ?? undefined);
    const res = await fetch(
      `${BOOK_API_BASE}/api/vendors/${encodeURIComponent(params.legacyVendorId)}/profile?${q.toString()}`,
      { headers }
    );
    if (res.ok) {
      const body = (await res.json()) as { bio?: string | null; websiteUrl?: string | null };
      const fromApi = {
        bio: body.bio?.trim() || null,
        websiteUrl: body.websiteUrl?.trim() || null,
      };
      if (fromApi.bio || fromApi.websiteUrl) return fromApi;
    }
  } catch {
    // Direct Supabase read is enough when RLS allows public vendor_profiles SELECT.
  }

  return empty;
}

/** @deprecated Prefer resolveVendorPublicProfile */
export async function resolveVendorProfileBio(params: {
  legacyVendorId: string;
  vendorProfileIdParam?: string | null;
  vendorName?: string | null;
  vendorSlug?: string | null;
  events: EventBioHint[];
  accessToken?: string | null;
}): Promise<string | null> {
  const profile = await resolveVendorPublicProfile(params);
  return profile.bio;
}

export function normalizeVendorWebsiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function formatVendorWebsiteLabel(raw: string): string {
  try {
    const hostname = new URL(normalizeVendorWebsiteUrl(raw)).hostname;
    return hostname.replace(/^www\./i, '');
  } catch {
    return raw.trim();
  }
}
