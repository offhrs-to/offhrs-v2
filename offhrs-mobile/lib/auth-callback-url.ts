import { completeOAuthBrowserSession } from '@/lib/auth-session-cleanup';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';

const onboardingTrace = (...args: unknown[]) => {
  if (Platform.OS === 'android') console.warn('[ONBOARDING_TRACE][AuthCallback]', ...args);
};

export type AuthCallbackParams = {
  code?: string;
  access_token?: string;
  refresh_token?: string;
};

/**
 * Deduplication guard: tracks the last token key processed and when.
 * On Android, Chrome Custom Tabs can fire BOTH a CCT-return (via openAuthSessionAsync)
 * AND a system Linking event for the same redirect URL. Each fires processAuthCallbackUrl
 * independently, which would call setSession / exchangeCodeForSession twice. The second call
 * can emit a spurious SIGNED_OUT → SIGNED_IN sequence that briefly clears the user and
 * resets all onboarding refs, causing the onboarding modal to re-appear.
 */
let _lastProcessedTokenKey: string | null = null;
let _lastProcessedAt = 0;
const DEDUP_WINDOW_MS = 8000;

function getTokenKey(params: AuthCallbackParams): string | null {
  if (params.code) return `code:${params.code.slice(0, 24)}`;
  if (params.access_token) return `at:${params.access_token.slice(0, 24)}`;
  return null;
}

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
  onboardingTrace('processAuthCallbackUrl parsed params', {
    hasCode: !!code,
    hasAccessToken: !!access_token,
    hasRefreshToken: !!refresh_token,
    hasError: !!error,
  });

  if (error) {
    __DEV__ && console.warn('[Auth] OAuth error in URL:', error, error_description);
    completeOAuthBrowserSession();
    return false;
  }

  return processAuthCallbackFromParams({ code, access_token, refresh_token });
}

/**
 * Process auth callback from already-parsed params (e.g. from route search params).
 * Use this when the app opens from a deep link and getInitialURL() returns null on iOS
 * but Expo Router has parsed the URL and exposed params on the callback route.
 */
export async function processAuthCallbackFromParams(
  params: AuthCallbackParams
): Promise<boolean> {
  const { code, access_token, refresh_token } = params;

  // Deduplication: if the same token was processed within DEDUP_WINDOW_MS, skip.
  // This prevents a second call to setSession/exchangeCodeForSession when CCT fires
  // both its native return value AND a system Linking event for the same redirect URL.
  const tokenKey = getTokenKey(params);
  if (tokenKey) {
    const now = Date.now();
    if (tokenKey === _lastProcessedTokenKey && now - _lastProcessedAt < DEDUP_WINDOW_MS) {
      __DEV__ && console.log('[Auth] Duplicate token detected within dedup window — skipping', tokenKey);
      onboardingTrace('duplicate token skipped', tokenKey);
      return true; // Return true so callers know auth succeeded (first call handled it)
    }
    _lastProcessedTokenKey = tokenKey;
    _lastProcessedAt = now;
  }

  if (code) {
    __DEV__ && console.log('[Auth] Processing code flow (Apple):', code.substring(0, 20) + '...');
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      __DEV__ && console.warn('[Auth] exchangeCodeForSession failed:', error.message, error);
      onboardingTrace('exchangeCodeForSession failed', error.message);
      // Clear the dedup key so a retry is allowed.
      if (tokenKey === _lastProcessedTokenKey) {
        _lastProcessedTokenKey = null;
        _lastProcessedAt = 0;
      }
      return false;
    }
    if (!data?.session) {
      __DEV__ && console.warn('[Auth] exchangeCodeForSession succeeded but no session returned');
      return false;
    }
    __DEV__ && console.log('[Auth] Code exchange successful, session established for user:', data.session.user.id);
    completeOAuthBrowserSession();
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
    onboardingTrace('setSession failed', error.message);
    if (tokenKey === _lastProcessedTokenKey) {
      _lastProcessedTokenKey = null;
      _lastProcessedAt = 0;
    }
    return false;
  }
  if (!data?.session) {
    __DEV__ && console.warn('[Auth] setSession succeeded but no session returned');
    onboardingTrace('setSession succeeded but no session returned');
    return false;
  }
  onboardingTrace('setSession success', data.session.user.id);
  __DEV__ && console.log('[Auth] Session set successfully for user:', data.session.user.id);
  completeOAuthBrowserSession();
  return true;
}
