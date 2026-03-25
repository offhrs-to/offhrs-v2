import '../global.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Modal, Platform } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppIntroScreen from '@/components/AppIntroScreen';
import { AuthProvider } from '@/contexts/AuthContext';
import { processAuthCallbackUrl } from '@/lib/auth-callback-url';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const HAS_SEEN_APP_INTRO_KEY = '@offhrs/hasSeenAppIntro';

const ROOT_BG = '#ECEFE5';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const router = useRouter();
  const [showAppIntro, setShowAppIntro] = useState(false);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(ROOT_BG);
  }, []);

  // Android Custom Tabs OAuth: completes the auth session when returning to the app (no iOS change).
  useEffect(() => {
    if (Platform.OS === 'android') {
      WebBrowser.maybeCompleteAuthSession();
    }
  }, []);

  // First-launch app intro: show once per install on native only
  useEffect(() => {
    if (Platform.OS === 'web') return;
    AsyncStorage.getItem(HAS_SEEN_APP_INTRO_KEY).then((seen) => {
      if (seen !== 'true') setShowAppIntro(true);
    });
  }, []);

  // Process OAuth callback when app opens from browser (e.g. "Open in offhrs-mobile")
  // so sign-in works even when the initial route is not /auth/callback
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cancelled = false;
    const goToProfile = () => {
      if (!cancelled) {
        __DEV__ && console.log('[RootLayout] Navigating to profile after auth');
        router.replace('/(tabs)/profile');
      }
    };

    // Initial URL check (app cold start from deep link)
    Linking.getInitialURL().then((url) => {
      if (cancelled) return;
      __DEV__ && console.log('[RootLayout] Initial URL:', url);
      processAuthCallbackUrl(url ?? null).then((handled) => {
        if (cancelled || !handled) return;
        setTimeout(goToProfile, 400);
      });
    });

    // On iOS, getInitialURL() can be null on cold start from deep link; retry once after a delay.
    const t = setTimeout(() => {
      Linking.getInitialURL().then((url) => {
        if (cancelled || !url) return;
        __DEV__ && console.log('[RootLayout] Retry initial URL:', url);
        processAuthCallbackUrl(url).then((handled) => {
          if (cancelled || !handled) return;
          setTimeout(goToProfile, 400);
        });
      });
    }, 500);

    // Listen for deep links while app is running (user taps "Open" after OAuth redirect)
    const sub = Linking.addEventListener('url', ({ url: eventUrl }) => {
      __DEV__ && console.log('[RootLayout] Link event:', eventUrl);
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

  const handleAppIntroDone = () => {
    AsyncStorage.setItem(HAS_SEEN_APP_INTRO_KEY, 'true');
    setShowAppIntro(false);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
            {showAppIntro && (
              <Modal visible transparent={false} animationType="fade">
                <AppIntroScreen onDone={handleAppIntroDone} />
              </Modal>
            )}
            <StatusBar style="dark" />
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
