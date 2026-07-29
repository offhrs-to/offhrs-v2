import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { BOOK_API_BASE } from '@/constants/api';
import { buildBookingApiHeaders } from '@/lib/booking-api-headers';

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: string };

type NativeExtra = {
  supabaseUrl?: string;
  bookApiBase?: string;
};

function expectedSupabaseProjectRef(): string | null {
  const extra = Constants.expoConfig?.extra as NativeExtra | undefined;
  const url =
    extra?.supabaseUrl?.trim() ||
    (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

function jwtSupabaseProjectRef(accessToken: string): string | null {
  try {
    const segment = accessToken.split('.')[1];
    if (!segment) return null;
    const payload = JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/'))) as {
      iss?: string;
    };
    const iss = payload.iss ?? '';
    const match = iss.match(/https:\/\/([^.]+)\.supabase\.co/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function sessionEnvironmentMismatch(accessToken: string): string | null {
  const expected = expectedSupabaseProjectRef();
  const actual = jwtSupabaseProjectRef(accessToken);
  if (expected && actual && expected !== actual) {
    return 'Your session is from a different app environment. Sign out, sign in again, then retry delete.';
  }
  return null;
}

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

  const envMismatch = sessionEnvironmentMismatch(accessToken);
  if (envMismatch) {
    return { ok: false, error: envMismatch };
  }

  try {
    let res = await postAccountDelete(accessToken);

    if (res.status === 401) {
      accessToken = await loadFreshAccessToken();
      if (!accessToken) {
        return { ok: false, error: 'Session expired. Please sign out and sign in again.' };
      }
      const retryMismatch = sessionEnvironmentMismatch(accessToken);
      if (retryMismatch) {
        return { ok: false, error: retryMismatch };
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
        error:
          parseDeleteApiError(body, res.status) ||
          'Too many delete attempts. Wait a few minutes and try again.',
      };
    }

    const message = parseDeleteApiError(body, res.status);
    if (res.status === 401 && message.includes('no session token')) {
      const extra = Constants.expoConfig?.extra as NativeExtra | undefined;
      const apiBase = extra?.bookApiBase?.trim() || BOOK_API_BASE;
      return {
        ok: false,
        error: `${message} (API: ${apiBase})`,
      };
    }

    return { ok: false, error: message };
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
