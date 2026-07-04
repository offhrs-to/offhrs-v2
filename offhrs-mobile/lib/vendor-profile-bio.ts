import * as Linking from 'expo-linking';
import { BOOK_API_BASE } from '@/constants/api';
import { buildBookingApiHeaders } from '@/lib/booking-api-headers';
import { supabase } from '@/lib/supabase';

const ACTIVE_VENDOR_STATUSES = ['trialing', 'active', 'past_due'] as const;

export type VendorPublicProfile = {
  bio: string | null;
  websiteUrl: string | null;
  instagramHandle: string | null;
  contactEmail: string | null;
};

type EventBioHint = {
  vendor_profile_id?: string | null;
  organizer?: string | null;
};

type ProfileRow = {
  bio?: string | null;
  website_url?: string | null;
  instagram_handle?: string | null;
};

function mapProfileRow(row: ProfileRow | null | undefined): VendorPublicProfile {
  const bio = row?.bio?.trim() || null;
  const websiteUrl = row?.website_url?.trim() || null;
  const instagramHandle = row?.instagram_handle?.trim() || null;
  return { bio, websiteUrl, instagramHandle, contactEmail: null };
}

function hasProfileContent(profile: VendorPublicProfile): boolean {
  return (
    profile.bio != null ||
    profile.websiteUrl != null ||
    profile.instagramHandle != null ||
    profile.contactEmail != null
  );
}

async function fetchProfileByProfileId(profileId: string): Promise<VendorPublicProfile | null> {
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('bio, website_url, instagram_handle')
    .eq('id', profileId)
    .in('status', [...ACTIVE_VENDOR_STATUSES])
    .maybeSingle();
  if (error || !data) return null;
  return mapProfileRow(data);
}

async function fetchProfileByBusinessName(name: string): Promise<VendorPublicProfile | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('bio, website_url, instagram_handle')
    .ilike('business_name', trimmed)
    .in('status', [...ACTIVE_VENDOR_STATUSES])
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapProfileRow(data);
}

async function fetchProfileBySlug(slug: string): Promise<VendorPublicProfile | null> {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('bio, website_url, instagram_handle')
    .eq('slug', trimmed)
    .in('status', [...ACTIVE_VENDOR_STATUSES])
    .maybeSingle();
  if (error || !data) return null;
  return mapProfileRow(data);
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
  let instagramHandle: string | null = null;
  let contactEmail: string | null = null;
  for (const p of profiles) {
    if (!p) continue;
    if (!bio && p.bio) bio = p.bio;
    if (!websiteUrl && p.websiteUrl) websiteUrl = p.websiteUrl;
    if (!instagramHandle && p.instagramHandle) instagramHandle = p.instagramHandle;
    if (!contactEmail && p.contactEmail) contactEmail = p.contactEmail;
    if (bio && websiteUrl && instagramHandle && contactEmail) break;
  }
  return { bio, websiteUrl, instagramHandle, contactEmail };
}

async function fetchVendorProfileFromApi(params: {
  legacyVendorId: string;
  vendorProfileIdParam?: string | null;
  accessToken?: string | null;
}): Promise<VendorPublicProfile | null> {
  const profileIdParam = params.vendorProfileIdParam?.trim();
  const q = new URLSearchParams();
  if (profileIdParam) q.set('vendorProfileId', profileIdParam);
  try {
    const headers = await buildBookingApiHeaders(params.accessToken ?? undefined);
    const res = await fetch(
      `${BOOK_API_BASE}/api/vendors/${encodeURIComponent(params.legacyVendorId)}/profile?${q.toString()}`,
      { headers }
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      bio?: string | null;
      websiteUrl?: string | null;
      instagramHandle?: string | null;
      contactEmail?: string | null;
    };
    return {
      bio: body.bio?.trim() || null,
      websiteUrl: body.websiteUrl?.trim() || null,
      instagramHandle: body.instagramHandle?.trim() || null,
      contactEmail: body.contactEmail?.trim() || null,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve partner public profile fields for a legacy `/vendors/[id]` page.
 * Optimized: one API call first; never loops per workshop row.
 */
export async function resolveVendorPublicProfile(params: {
  legacyVendorId: string;
  vendorProfileIdParam?: string | null;
  vendorName?: string | null;
  vendorSlug?: string | null;
  events?: EventBioHint[];
  accessToken?: string | null;
}): Promise<VendorPublicProfile> {
  const empty: VendorPublicProfile = {
    bio: null,
    websiteUrl: null,
    instagramHandle: null,
    contactEmail: null,
  };

  const fromApi = await fetchVendorProfileFromApi(params);
  if (fromApi && hasProfileContent(fromApi)) {
    return fromApi;
  }

  const found: VendorPublicProfile[] = [];
  if (fromApi) found.push(fromApi);

  const profileIdParam = params.vendorProfileIdParam?.trim();
  if (profileIdParam) {
    const fromParam = await fetchProfileByProfileId(profileIdParam);
    if (fromParam) found.push(fromParam);
  } else {
    const uniqueProfileIds = [
      ...new Set(
        (params.events ?? [])
          .map((row) => row.vendor_profile_id?.trim())
          .filter((pid): pid is string => Boolean(pid))
      ),
    ];
    for (const pid of uniqueProfileIds.slice(0, 2)) {
      const fromEvent = await fetchProfileByProfileId(pid);
      if (fromEvent) found.push(fromEvent);
    }
  }

  const merged = mergeProfiles(...found);
  if (hasProfileContent(merged)) return merged;

  if (params.vendorSlug?.trim()) {
    const fromSlug = await fetchProfileBySlug(params.vendorSlug);
    if (fromSlug) return mergeProfiles(merged, fromSlug);
  }

  const names = new Set<string>();
  if (params.vendorName?.trim()) names.add(params.vendorName.trim());
  for (const row of params.events ?? []) {
    if (row.organizer?.trim()) names.add(row.organizer.trim());
  }

  for (const name of names) {
    const fromName = await fetchProfileByBusinessName(name);
    if (fromName) return mergeProfiles(merged, fromName);
    const fromDerivedSlug = await fetchProfileBySlug(slugFromName(name));
    if (fromDerivedSlug) return mergeProfiles(merged, fromDerivedSlug);
  }

  return merged.bio || merged.websiteUrl || merged.instagramHandle || merged.contactEmail ? merged : empty;
}

export function openVendorContactEmail(vendorName: string, email: string): void {
  const subject = encodeURIComponent(`Message for ${vendorName.trim() || 'workshop host'} on offhrs`);
  void Linking.openURL(`mailto:${email.trim()}?subject=${subject}`);
}

/** @deprecated Prefer resolveVendorPublicProfile */
export async function resolveVendorProfileBio(params: {
  legacyVendorId: string;
  vendorProfileIdParam?: string | null;
  vendorName?: string | null;
  vendorSlug?: string | null;
  events?: EventBioHint[];
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
