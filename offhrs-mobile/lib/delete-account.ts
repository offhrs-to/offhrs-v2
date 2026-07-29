import { supabase } from '@/lib/supabase';
import { BOOK_API_BASE } from '@/constants/api';
import { buildBookingApiHeaders } from '@/lib/booking-api-headers';

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: string };

function parseDeleteApiError(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error.trim();
    }
    if (record.error && typeof record.error === 'object') {
      const nested = record.error as Record<string, unknown>;
      if (typeof nested.message === 'string' && nested.message.trim()) {
        return nested.message.trim();
      }
    }
  }

  if (status === 401) {
    return 'Could not verify your session. Sign out, sign in again, and retry.';
  }

  return `Failed to delete account (HTTP ${status})`;
}

async function loadFreshAccessToken(): Promise<string | null> {
  const refreshed = await supabase.auth.refreshSession();
  const refreshedToken = refreshed.data.session?.access_token?.trim();
  if (refreshedToken) return refreshedToken;

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token?.trim() ?? null;
}

async function postAccountDelete(accessToken: string): Promise<Response> {
  const headers = await buildBookingApiHeaders(accessToken);
  return fetch(`${BOOK_API_BASE}/api/account/delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ access_token: accessToken }),
  });
}

/**
 * Permanently deletes the signed-in consumer account via the deployed Next.js API.
 */
export async function deleteAuthenticatedUserAccount(): Promise<DeleteAccountResult> {
  let accessToken = await loadFreshAccessToken();
  if (!accessToken) {
    return { ok: false, error: 'Session expired. Please sign out and sign in again.' };
  }

  try {
    let res = await postAccountDelete(accessToken);

    if (res.status === 401) {
      accessToken = await loadFreshAccessToken();
      if (!accessToken) {
        return { ok: false, error: 'Session expired. Please sign out and sign in again.' };
      }
      res = await postAccountDelete(accessToken);
    }

    const body: unknown = await res.json().catch(() => ({}));

    if (res.ok) {
      return { ok: true };
    }

    if (res.status === 429) {
      return {
        ok: false,
        error: parseDeleteApiError(body, res.status) || 'Too many delete attempts. Wait a few minutes and try again.',
      };
    }

    return {
      ok: false,
      error: parseDeleteApiError(body, res.status),
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
