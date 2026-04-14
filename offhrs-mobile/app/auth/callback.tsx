import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

import {
  processAuthCallbackFromParams,
  processAuthCallbackUrl,
} from '@/lib/auth-callback-url';
import { completeOAuthBrowserSession } from '@/lib/auth-session-cleanup';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  }>();
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const finish = (goToProfile: boolean, error?: string) => {
      if (cancelled) return;
      if (error) {
        setErrorMsg(error);
        setTimeout(() => {
          if (!cancelled) router.replace('/login');
        }, 3000);
        return;
      }
      __DEV__ && console.log('[AuthCallback] Navigating to:', goToProfile ? 'profile' : 'login');
      router.replace(goToProfile ? '/(tabs)/profile' : '/login');
    };

    const run = async () => {
      __DEV__ && console.log('[AuthCallback] Starting auth flow');
      __DEV__ && console.log('[AuthCallback] Route params:', { 
        hasCode: !!params.code, 
        hasAccessToken: !!params.access_token,
        hasError: !!params.error,
        code: params.code ? params.code.substring(0, 20) + '...' : undefined,
        error: params.error,
      });

      try {
        // Check for OAuth errors in params (e.g. Supabase couldn't exchange Apple code)
        if (params.error) {
          __DEV__ && console.warn('[AuthCallback] OAuth error in params:', params.error, params.error_description);
          // If we already have a session, the error may be from a duplicate attempt; go to profile
          const { data: { session } } = await supabase.auth.getSession();
          if (cancelled) return;
          if (session) {
            __DEV__ && console.log('[AuthCallback] Session exists despite error param, navigating to profile');
            setTimeout(() => finish(true), 100);
            return;
          }
          const rawDesc = params.error_description || params.error;
          const shortMsg = rawDesc.length > 80 ? rawDesc.slice(0, 77) + '…' : rawDesc;
          finish(false, `Sign-in failed: ${shortMsg}`);
          return;
        }

        // 1) Prefer route params: on iOS cold start from "Open in offhrs-mobile",
        //    getInitialURL() often returns null but Expo Router has parsed the URL into params.
        if (params.code || params.access_token) {
          __DEV__ && console.log('[AuthCallback] Processing route params');
          const handled = await processAuthCallbackFromParams({
            code: params.code,
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
          if (cancelled) return;
          if (handled) {
            __DEV__ && console.log('[AuthCallback] Route params handled successfully');
            setTimeout(() => finish(true), 300);
            return;
          }
          __DEV__ && console.log('[AuthCallback] Route params failed to handle');
        }

        // 2) Try getInitialURL() (works when not cold start or on Android).
        const rawUrl = await Linking.getInitialURL();
        __DEV__ && console.log('[AuthCallback] getInitialURL():', rawUrl);
        const handledFromUrl = await processAuthCallbackUrl(rawUrl ?? null);
        if (cancelled) return;
        if (handledFromUrl) {
          __DEV__ && console.log('[AuthCallback] Initial URL handled successfully');
          setTimeout(() => finish(true), 300);
          return;
        }

        // 3) On iOS, URL can be delivered late; retry once after a short delay.
        await new Promise((r) => setTimeout(r, 400));
        if (cancelled) return;
        const retryUrl = await Linking.getInitialURL();
        __DEV__ && console.log('[AuthCallback] Retry getInitialURL():', retryUrl);
        const handledRetry = await processAuthCallbackUrl(retryUrl ?? null);
        if (cancelled) return;
        if (handledRetry) {
          __DEV__ && console.log('[AuthCallback] Retry URL handled successfully');
          setTimeout(() => finish(true), 300);
          return;
        }

        // 4) Last resort: check if there's already a session (user might have signed in before)
        const { data: { session } } = await supabase.auth.getSession();
        __DEV__ && console.log('[AuthCallback] Final session check:', !!session);
        finish(!!session);
      } finally {
        completeOAuthBrowserSession();
      }
    };

    run();

    const sub = Linking.addEventListener('url', ({ url: eventUrl }) => {
      __DEV__ && console.log('[AuthCallback] Link event received:', eventUrl);
      processAuthCallbackUrl(eventUrl).then((handled) => {
        completeOAuthBrowserSession();
        if (cancelled) return;
        if (handled) {
          __DEV__ && console.log('[AuthCallback] Link event handled successfully');
          setTimeout(() => finish(true), 300);
        }
      });
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [router, params.code, params.access_token, params.refresh_token, params.error, params.error_description]);

  if (errorMsg) {
    const isExchangeError = /exchange|external code/i.test(errorMsg);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#DC2626', marginBottom: 12, textAlign: 'center' }}>
          {errorMsg}
        </Text>
        {isExchangeError && (
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 12, paddingHorizontal: 16 }}>
            This often means the Apple sign-in setup in Supabase needs updating: check Redirect URLs include your app URL, and that the Apple Secret Key (client secret JWT) is valid and not expired (rotate every 6 months).
          </Text>
        )}
        <Text style={{ color: '#6B7280', textAlign: 'center' }}>
          Redirecting to login...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12 }}>Completing sign in...</Text>
    </View>
  );
}
