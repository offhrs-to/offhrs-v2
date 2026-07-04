import * as Linking from 'expo-linking';

import { BOOK_API_BASE } from '@/constants/api';
import { buildBookingApiHeaders } from '@/lib/booking-api-headers';

export async function fetchVendorContactEmail(params: {
  legacyVendorId: string;
  vendorProfileId?: string | null;
  accessToken?: string | null;
}): Promise<string | null> {
  const profileIdParam = params.vendorProfileId?.trim();
  const q = new URLSearchParams();
  if (profileIdParam) q.set('vendorProfileId', profileIdParam);
  try {
    const headers = await buildBookingApiHeaders(params.accessToken ?? undefined);
    const res = await fetch(
      `${BOOK_API_BASE}/api/vendors/${encodeURIComponent(params.legacyVendorId)}/profile?${q.toString()}`,
      { headers }
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { contactEmail?: string | null };
    const email = body.contactEmail?.trim();
    return email || null;
  } catch {
    return null;
  }
}

export function buildBookingContactMailtoUrl(params: {
  contactEmail: string;
  workshopTitle: string;
  dateLine: string;
  bookingRef?: string | null;
}): string {
  const subject = encodeURIComponent(
    `Booking question — ${params.workshopTitle.trim()} — ${params.dateLine.trim()}`
  );
  const bodyParts = [
    'Hi,',
    '',
    `I have a question about my booking for ${params.workshopTitle.trim()} (${params.dateLine.trim()}).`,
  ];
  if (params.bookingRef?.trim()) {
    bodyParts.push('', `Booking reference: ${params.bookingRef.trim()}`);
  }
  bodyParts.push('', 'Thanks,');
  const body = encodeURIComponent(bodyParts.join('\n'));
  return `mailto:${params.contactEmail.trim()}?subject=${subject}&body=${body}`;
}

export async function openBookingContactHost(params: {
  legacyVendorId: string;
  vendorProfileId?: string | null;
  workshopTitle: string;
  dateLine: string;
  bookingRef?: string | null;
  accessToken?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const email = await fetchVendorContactEmail({
    legacyVendorId: params.legacyVendorId,
    vendorProfileId: params.vendorProfileId,
    accessToken: params.accessToken,
  });
  if (!email) {
    return {
      ok: false,
      message: 'This host has not shared a contact email yet. Try their vendor page for other ways to reach them.',
    };
  }
  try {
    await Linking.openURL(
      buildBookingContactMailtoUrl({
        contactEmail: email,
        workshopTitle: params.workshopTitle,
        dateLine: params.dateLine,
        bookingRef: params.bookingRef,
      })
    );
    return { ok: true };
  } catch {
    return { ok: false, message: 'Could not open your mail app. Please email the host from your device.' };
  }
}
