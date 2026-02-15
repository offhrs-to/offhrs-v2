import { supabase } from '@/lib/supabase';

export function parseAuthParams(url: string): {
  access_token?: string;
  refresh_token?: string;
  code?: string;
  error?: string;
  error_description?: string;
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
    error: params.error,
    error_description: params.error_description,
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
  
  const { access_token, refresh_token, code, error, error_description } = parseAuthParams(u);
  
  // Check for OAuth errors first
  if (error) {
    __DEV__ && console.warn('[Auth] OAuth error in URL:', error, error_description);
    return false;
  }
  
  return processAuthCallbackFromParams({ code, access_token, refresh_token });
}

export type AuthCallbackParams = {
  code?: string;
  access_token?: string;
  refresh_token?: string;
};

/**
 * Process auth callback from already-parsed params (e.g. from route search params).
 * Use this when the app opens from a deep link and getInitialURL() returns null on iOS
 * but Expo Router has parsed the URL and exposed params on the callback route.
 */
export async function processAuthCallbackFromParams(
  params: AuthCallbackParams
): Promise<boolean> {
  const { code, access_token, refresh_token } = params;
  
  if (code) {
    __DEV__ && console.log('[Auth] Processing code flow (Apple):', code.substring(0, 20) + '...');
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      __DEV__ && console.warn('[Auth] exchangeCodeForSession failed:', error.message, error);
      return false;
    }
    if (!data?.session) {
      __DEV__ && console.warn('[Auth] exchangeCodeForSession succeeded but no session returned');
      return false;
    }
    __DEV__ && console.log('[Auth] Code exchange successful, session established for user:', data.session.user.id);
    return true;
  }
  
  if (!access_token) {
    __DEV__ && console.log('[Auth] No code or access_token in params');
    return false;
  }
  
  __DEV__ && console.log('[Auth] Processing implicit flow (Google)');
  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token: refresh_token ?? '',
  });
  if (error) {
    __DEV__ && console.warn('[Auth] setSession failed:', error.message, error);
    return false;
  }
  if (!data?.session) {
    __DEV__ && console.warn('[Auth] setSession succeeded but no session returned');
    return false;
  }
  __DEV__ && console.log('[Auth] Session set successfully for user:', data.session.user.id);
  return true;
}
