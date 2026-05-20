import { supabase } from '@/lib/supabase';
import { BOOK_API_BASE } from '@/constants/api';
import { buildBookingApiHeaders } from '@/lib/booking-api-headers';

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Permanently deletes the signed-in consumer account via the deployed Next.js API.
 */
export async function deleteAuthenticatedUserAccount(): Promise<DeleteAccountResult> {
  let {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: 'Not signed in' };
  }

  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
  if (expiresAtMs > 0 && expiresAtMs <= Date.now() + 60_000) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session?.access_token) {
      return { ok: false, error: 'Session expired. Please sign in again.' };
    }
    session = refreshed.data.session;
  }

  try {
    let res = await fetch(`${BOOK_API_BASE}/api/account/delete`, {
      method: 'POST',
      headers: await buildBookingApiHeaders(session.access_token),
    });

    if (res.status === 401) {
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.error || !refreshed.data.session?.access_token) {
        return { ok: false, error: 'Session expired. Please sign in again.' };
      }
      session = refreshed.data.session;
      res = await fetch(`${BOOK_API_BASE}/api/account/delete`, {
        method: 'POST',
        headers: await buildBookingApiHeaders(session.access_token),
      });
    }

    const body = (await res.json().catch(() => ({}))) as { error?: string; stage?: string };

    if (res.ok) {
      return { ok: true };
    }

    if (res.status === 401) {
      return {
        ok: false,
        error:
          body.error?.trim() ||
          'Unauthorized. Add EXPO_PUBLIC_VERCEL_PROTECTION_BYPASS for preview builds.',
      };
    }

    const suffix = body.stage ? ` [${body.stage}]` : '';
    return {
      ok: false,
      error: `${body.error?.trim() || `Failed to delete account (HTTP ${res.status})`}${suffix}`,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Network error while deleting account',
    };
  }
}
