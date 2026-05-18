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
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: 'Not signed in' };
  }

  const headers = await buildBookingApiHeaders(session.access_token);

  try {
    const res = await fetch(`${BOOK_API_BASE}/api/account/delete`, {
      method: 'POST',
      headers,
    });

    const body = (await res.json().catch(() => ({}))) as { error?: string };

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

    return { ok: false, error: body.error?.trim() || 'Failed to delete account' };
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
