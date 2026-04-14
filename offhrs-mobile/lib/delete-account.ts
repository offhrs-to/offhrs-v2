import { supabase } from '@/lib/supabase';
import { getWebAppOrigin } from '@/lib/web-app-links';

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

  const base = getWebAppOrigin();
  const res = await fetch(`${base}/api/account/delete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  const body = (await res.json().catch(() => ({}))) as { error?: string };

  if (!res.ok) {
    return {
      ok: false,
      error: body.error ?? 'Failed to delete account',
    };
  }

  return { ok: true };
}
