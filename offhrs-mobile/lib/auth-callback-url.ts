import { supabase } from '@/lib/supabase';

export function parseAuthParams(url: string): {
  access_token?: string;
  refresh_token?: string;
  code?: string;
} {
  const params: Record<string, string> = {};
  const s = typeof url === 'string' ? url : '';
  const decode = (x: string) => decodeURIComponent(x.replace(/\+/g, ' '));
  const parse = (x: string) => {
    if (typeof x !== 'string') return;
    x.split('&').forEach((pair) => {
      const [k, v] = pair.split('=');
      if (k && v) params[decode(k)] = decode(v);
    });
  };
  const afterQuery = s.indexOf('?') >= 0 ? s.split('?')[1] ?? '' : '';
  const queryPart = afterQuery.indexOf('#') >= 0 ? afterQuery.split('#')[0] : afterQuery;
  const hashPart = s.indexOf('#') >= 0 ? s.split('#')[1] : '';
  if (queryPart) parse(queryPart);
  if (hashPart) parse(hashPart);
  return {
    access_token: params.access_token,
    refresh_token: params.refresh_token,
    code: params.code,
  };
}

/**
 * Returns true if the URL was an auth callback and the session was set successfully.
 * Call this when the app opens (getInitialURL) or receives a URL (link event) so
 * OAuth works even when the initial route is not /auth/callback.
 * Supports:
 * - Implicit flow: #access_token=...&refresh_token=... (e.g. Google)
 * - Code flow: ?code=... (e.g. Apple on iOS)
 */
export async function processAuthCallbackUrl(url: string | null): Promise<boolean> {
  const u = typeof url === 'string' ? url : '';
  if (!u) return false;
  const { access_token, refresh_token, code } = parseAuthParams(u);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return !error;
  }

  if (!access_token) return false;
  const { error } = await supabase.auth.setSession({
    access_token,
    refresh_token: refresh_token ?? '',
  });
  return !error;
}
