import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

import {
  processAuthCallbackFromParams,
  processAuthCallbackUrl,
} from '@/lib/auth-callback-url';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    access_token?: string;
    refresh_token?: string;
  }>();

  useEffect(() => {
    let cancelled = false;

    const finish = (goToProfile: boolean) => {
      if (cancelled) return;
      router.replace(goToProfile ? '/(tabs)/profile' : '/login');
    };

    const run = async () => {
      // 1) Prefer route params: on iOS cold start from "Open in offhrs-mobile",
      //    getInitialURL() often returns null but Expo Router has parsed the URL into params.
      if (params.code || params.access_token) {
        const handled = await processAuthCallbackFromParams({
          code: params.code,
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (cancelled) return;
        if (handled) {
          setTimeout(() => finish(true), 300);
          return;
        }
      }

      // 2) Try getInitialURL() (works when not cold start or on Android).
      const rawUrl = await Linking.getInitialURL();
      const handledFromUrl = await processAuthCallbackUrl(rawUrl ?? null);
      if (cancelled) return;
      if (handledFromUrl) {
        setTimeout(() => finish(true), 300);
        return;
      }

      // 3) On iOS, URL can be delivered late; retry once after a short delay.
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;
      const retryUrl = await Linking.getInitialURL();
      const handledRetry = await processAuthCallbackUrl(retryUrl ?? null);
      if (cancelled) return;
      if (handledRetry) {
        setTimeout(() => finish(true), 300);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      finish(!!session);
    };

    run();

    const sub = Linking.addEventListener('url', ({ url: eventUrl }) => {
      processAuthCallbackUrl(eventUrl).then((handled) => {
        if (cancelled) return;
        if (handled) setTimeout(() => finish(true), 300);
      });
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [router, params.code, params.access_token, params.refresh_token]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12 }}>Completing sign in...</Text>
    </View>
  );
}
