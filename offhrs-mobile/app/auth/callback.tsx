import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

import { processAuthCallbackUrl } from '@/lib/auth-callback-url';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const finish = (goToProfile: boolean) => {
      if (cancelled) return;
      router.replace(goToProfile ? '/(tabs)/profile' : '/login');
    };

    const run = async () => {
      const rawUrl = await Linking.getInitialURL();
      const handled = await processAuthCallbackUrl(rawUrl ?? null);
      if (cancelled) return;
      if (handled) {
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
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12 }}>Completing sign in...</Text>
    </View>
  );
}
