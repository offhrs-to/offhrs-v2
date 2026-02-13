import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

import { supabase } from '@/lib/supabase';

function parseAuthParams(url: string): { access_token?: string; refresh_token?: string } {
  const params: Record<string, string> = {};
  const s = typeof url === 'string' ? url : '';
  const decode = (x: string) => decodeURIComponent(x.replace(/\+/g, ' '));
  const parse = (x: string) => {
    x.split('&').forEach((pair) => {
      const [k, v] = pair.split('=');
      if (k && v) params[decode(k)] = decode(v);
    });
  };
  // Supabase may send tokens in query (?...) or hash (#...) depending on flow
  const afterQuery = s.indexOf('?') >= 0 ? s.split('?')[1] ?? '' : '';
  const queryPart = afterQuery.indexOf('#') >= 0 ? afterQuery.split('#')[0] : afterQuery;
  const hashPart = s.indexOf('#') >= 0 ? s.split('#')[1] : '';
  if (queryPart) parse(queryPart);
  if (hashPart) parse(hashPart);
  return { access_token: params.access_token, refresh_token: params.refresh_token };
}

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
      const url = typeof rawUrl === 'string' ? rawUrl : '';
      if (url && url.indexOf('auth/callback') >= 0) {
        const { access_token, refresh_token } = parseAuthParams(url);
        if (access_token) {
          const { error: err } = await supabase.auth.setSession({
            access_token,
            refresh_token: refresh_token ?? '',
          });
          if (err) {
            finish(false);
            return;
          }
          // Let AuthContext's onAuthStateChange run and update before navigating to profile
          setTimeout(() => finish(true), 300);
          return;
        }
      }
      const { data: { session } } = await supabase.auth.getSession();
      finish(!!session);
    };

    run();

    const sub = Linking.addEventListener('url', ({ url: eventUrl }) => {
      const u = typeof eventUrl === 'string' ? eventUrl : '';
      if (!u || u.indexOf('auth/callback') < 0) return;
      const { access_token, refresh_token } = parseAuthParams(u);
      if (access_token) {
        supabase.auth.setSession({ access_token, refresh_token: refresh_token ?? '' }).then(({ error: err }) => {
          if (cancelled) return;
          if (err) finish(false);
          else setTimeout(() => finish(true), 300);
        });
      }
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
