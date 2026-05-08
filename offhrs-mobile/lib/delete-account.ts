import { supabase } from '@/lib/supabase';
import { getWebAppOrigin } from '@/lib/web-app-links';
import { BOOK_API_BASE } from '@/constants/api';

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Permanently deletes the signed-in user via the same Next.js route as the web app.
 */
export async function deleteAuthenticatedUserAccount(): Promise<DeleteAccountResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: 'Not signed in' };
  }

  const bases = [getWebAppOrigin(), BOOK_API_BASE].filter(
    (value, index, arr) => !!value && arr.indexOf(value) === index
  );

  let lastError = 'Failed to delete account';

  for (const base of bases) {
    try {
      const res = await fetch(`${base}/api/account/delete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const body = (await res.json().catch(() => ({}))) as { error?: string };

      if (res.ok) {
        return { ok: true };
      }

      lastError = body.error ?? 'Failed to delete account';
      // Wrong/stale EXPO_PUBLIC_APP_URL often returns 401/404; always try BOOK_API_BASE next.
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : 'Network error while deleting account';
    }
  }

  return { ok: false, error: lastError };
}

