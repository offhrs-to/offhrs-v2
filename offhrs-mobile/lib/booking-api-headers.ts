/**
 * Headers for Next.js booking API calls from the mobile app (`/api/book` and `/api/book/confirm`).
 * Preview Vercel deployments with Deployment Protection return 401 unless bypass is sent.
 */
export async function buildBookingApiHeaders(
  accessToken: string | undefined
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const bypass = (process.env.EXPO_PUBLIC_VERCEL_PROTECTION_BYPASS ?? '').trim();
  if (bypass) {
    headers['x-vercel-protection-bypass'] = bypass;
  }
  return headers;
}

/** User-facing hint when preview API returns 401 (often Vercel protection, not Supabase). */
export function bookingApiErrorMessage(status: number, bodyError?: string): string {
  if (status === 401) {
    return (
      bodyError?.trim() ||
      'Booking API returned unauthorized (401). If this is a Vercel Preview build, add EXPO_PUBLIC_VERCEL_PROTECTION_BYPASS from Vercel → Deployment Protection, or disable protection for Preview.'
    );
  }
  if (status === 404) {
    return (
      bodyError?.trim() ||
      'Booking API not found (404). Redeploy the preview API or confirm EXPO_PUBLIC_BOOK_API_BASE points at the latest deployment.'
    );
  }
  return bodyError?.trim() || `Request failed (${status})`;
}
