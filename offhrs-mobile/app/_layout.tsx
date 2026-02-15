import '../global.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/contexts/AuthContext';
import { processAuthCallbackUrl } from '@/lib/auth-callback-url';

const ROOT_BG = '#ECEFE5';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(ROOT_BG);
  }, []);

  // Process OAuth callback when app opens from browser (e.g. "Open in offhrs-mobile")
  // so sign-in works even when the initial route is not /auth/callback
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cancelled = false;
    const goToProfile = () => {
      if (!cancelled) router.replace('/(tabs)/profile');
    };

    Linking.getInitialURL().then((url) => {
      if (cancelled) return;
      processAuthCallbackUrl(url ?? null).then((handled) => {
        if (cancelled || !handled) return;
        setTimeout(goToProfile, 400);
      });
    });

    // On iOS, getInitialURL() can be null on cold start from deep link; retry once after a delay.
    const t = setTimeout(() => {
      Linking.getInitialURL().then((url) => {
        if (cancelled || !url) return;
        processAuthCallbackUrl(url).then((handled) => {
          if (cancelled || !handled) return;
          setTimeout(goToProfile, 400);
        });
      });
    }, 500);

    const sub = Linking.addEventListener('url', ({ url: eventUrl }) => {
      processAuthCallbackUrl(eventUrl).then((handled) => {
        if (cancelled || !handled) return;
        setTimeout(goToProfile, 400);
      });
    });

    return () => {
      cancelled = true;
      clearTimeout(t);
      sub.remove();
    };
  }, [router]);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={DefaultTheme}>
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: ROOT_BG },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
            <Stack.Screen name="vendors/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="dark" />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
