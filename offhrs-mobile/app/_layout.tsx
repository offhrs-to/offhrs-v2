import '../global.css';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Modal, Platform } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppIntroScreen from '@/components/AppIntroScreen';
import PilotLaunchNoticeModal, {
  PILOT_LAUNCH_ACK_KEY,
} from '@/components/PilotLaunchNoticeModal';
import { AuthProvider } from '@/contexts/AuthContext';
import { processAuthCallbackUrl } from '@/lib/auth-callback-url';
import { completeOAuthBrowserSession } from '@/lib/auth-session-cleanup';
import {
  AppFonts,
  nunitoSansFontMap,
} from '@/lib/nunito-sans';
import {
  isOnboardingModalOpen,
  subscribeOnboardingModalOpen,
} from '@/lib/onboarding-modal-gate';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* already prevented / not available */
});

const HAS_SEEN_APP_INTRO_KEY = '@offhrs/hasSeenAppIntro';

const ROOT_BG = '#FFFFFF';

const AppNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: ROOT_BG,
  },
  fonts: {
    regular: {
      fontFamily: AppFonts.regular,
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: AppFonts.medium,
      fontWeight: '500' as const,
    },
    bold: {
      fontFamily: AppFonts.bold,
      fontWeight: '600' as const,
    },
    heavy: {
      fontFamily: AppFonts.extraBold,
      fontWeight: '700' as const,
    },
  },
};

function resolveStripePublishableKey(): string {
  const extra = (
    Constants.expoConfig?.extra as { stripePublishableKey?: string } | undefined
  )?.stripePublishableKey;
  return (extra ?? process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').trim();
}

/** Native only: Payment Sheet + Apple Pay / Google Pay need a configured publishable key. */
function StripeRoot({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') {
    return <>{children}</>;
  }
  const pk = resolveStripePublishableKey();
  if (!pk.startsWith('pk_')) {
    return <>{children}</>;
  }
  return (
    <StripeProvider
      publishableKey={pk}
      merchantIdentifier="merchant.com.offhrs.app"
      urlScheme="offhrsmobile"
    >
      {children as ReactElement}
    </StripeProvider>
  );
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [fontsLoaded, fontError] = useFonts(nunitoSansFontMap);
  const [showAppIntro, setShowAppIntro] = useState(false);
  const [showPilotLaunchNotice, setShowPilotLaunchNotice] = useState(false);
  /** Blocks pilot notice until intro slides are done or were already seen this install. */
  const [introGate, setIntroGate] = useState<'loading' | 'needs_intro' | 'done'>('loading');
  /** Avoid stacking pilot notice on top of OnboardingModal (iOS Modal touch issues). */
  const [onboardingModalOpen, setOnboardingModalOpenState] = useState(isOnboardingModalOpen());

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    SplashScreen.hideAsync().catch(() => {
      /* already hidden */
    });
  }, [fontsLoaded, fontError]);

  useEffect(() => subscribeOnboardingModalOpen(() => {
    setOnboardingModalOpenState(isOnboardingModalOpen());
  }), []);

  // Always-current snapshot of navigation segments accessible inside async closures.
  const segmentsRef = useRef<readonly string[]>(segments);
  segmentsRef.current = segments;

  // One-shot guard: prevents duplicate router.replace calls when multiple Linking paths
  // (initial URL check, 500ms retry, Linking event) all receive the same OAuth redirect.
  const authNavDoneRef = useRef(false);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(ROOT_BG);
  }, []);

  // EAS OTA: fetch and apply pending update on cold start so preview testers
  // do not need a second relaunch to pick up the latest mobile JS bundle.
  useEffect(() => {
    if (Platform.OS === 'web' || __DEV__) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (cancelled || !result.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        await Updates.reloadAsync();
      } catch {
        // Offline / no updates / dev client without Updates configured: ignore.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // OAuth (Android Custom Tabs + iOS ASWebAuthenticationSession): complete session when returning to the app.
  useEffect(() => {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      WebBrowser.maybeCompleteAuthSession();
    }
  }, []);

  // First-launch gates: load intro + pilot flags together so pilot never flashes before slides.
  useEffect(() => {
    if (Platform.OS === 'web') {
      setIntroGate('done');
      return;
    }
    Promise.all([
      AsyncStorage.getItem(HAS_SEEN_APP_INTRO_KEY),
      AsyncStorage.getItem(PILOT_LAUNCH_ACK_KEY),
    ]).then(([introSeen, pilotAcknowledged]) => {
      if (introSeen !== 'true') {
        setShowAppIntro(true);
        setIntroGate('needs_intro');
      } else {
        setIntroGate('done');
      }
      if (pilotAcknowledged !== 'true') {
        setShowPilotLaunchNotice(true);
      }
    });
  }, []);

  // Process OAuth callback when app opens from browser (e.g. "Open in offhrs-mobile")
  // so sign-in works even when the initial route is not /auth/callback
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Reset the one-shot guard each time this effect (re-)runs so that a genuine
    // sign-out → sign-in cycle gets a fresh navigation attempt.
    authNavDoneRef.current = false;
    let cancelled = false;

    const goToProfile = () => {
      if (cancelled) return;

      // Android hard-stop: never force a router.replace from RootLayout after OAuth callback.
      // Android sign-in paths already handle navigation (login onSignInSuccess or callback route).
      // Forcing replace from here can re-enter/recreate tab screens during onboarding and reopen modal.
      if (Platform.OS === 'android') {
        return;
      }

      // One-shot: only navigate once per effect lifecycle regardless of how many
      // Linking events or getInitialURL retries fire with the same OAuth URL.
      if (authNavDoneRef.current) {
        return;
      }

      authNavDoneRef.current = true;
      router.replace('/(tabs)/profile');
    };

    // Initial URL check (app cold start from deep link)
    Linking.getInitialURL().then((url) => {
      if (cancelled) return;
      processAuthCallbackUrl(url ?? null).then((handled) => {
        completeOAuthBrowserSession();
        if (cancelled || !handled) return;
        setTimeout(goToProfile, 400);
      });
    });

    // On iOS, getInitialURL() can be null on cold start from deep link; retry once after a delay.
    // Android does NOT need this retry — openAuthSessionAsync delivers the URL directly via its
    // return value, so the URL is always available on the first getInitialURL() call. Running this
    // retry on Android produces a spurious ~900ms delayed goToProfile call that can interfere with
    // the onboarding modal while the user is mid-fill.
    const t = Platform.OS === 'ios' ? setTimeout(() => {
      Linking.getInitialURL().then((url) => {
        if (cancelled || !url) return;
        processAuthCallbackUrl(url).then((handled) => {
          completeOAuthBrowserSession();
          if (cancelled || !handled) return;
          setTimeout(goToProfile, 400);
        });
      });
    }, 500) : null;

    // Listen for deep links while app is running (user taps "Open" after OAuth redirect)
    const sub = Linking.addEventListener('url', ({ url: eventUrl }) => {
      processAuthCallbackUrl(eventUrl).then((handled) => {
        completeOAuthBrowserSession();
        if (cancelled || !handled) return;
        setTimeout(goToProfile, 400);
      });
    });

    return () => {
      cancelled = true;
      if (t !== null) clearTimeout(t);
      sub.remove();
    };
  }, [router]);

  const handleAppIntroDone = () => {
    AsyncStorage.setItem(HAS_SEEN_APP_INTRO_KEY, 'true');
    setShowAppIntro(false);
    setIntroGate('done');
  };

  const acknowledgePilotLaunch = () => {
    AsyncStorage.setItem(PILOT_LAUNCH_ACK_KEY, 'true');
    setShowPilotLaunchNotice(false);
  };

  const showPilotLaunchModal =
    introGate === 'done' &&
    showPilotLaunchNotice &&
    !showAppIntro &&
    !onboardingModalOpen;

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StripeRoot>
          <AuthProvider>
            <ThemeProvider value={AppNavigationTheme}>
              <Stack
                screenOptions={{
                  contentStyle: { backgroundColor: ROOT_BG },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
                <Stack.Screen name="vendors/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="workshop-search" options={{ headerShown: false }} />
                <Stack.Screen name="workshop-map" options={{ headerShown: false }} />
                <Stack.Screen name="workshop-browse" options={{ headerShown: false }} />
                <Stack.Screen name="shop/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="shop-checkout" options={{ headerShown: false }} />
                <Stack.Screen name="contact" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
              {/* Android: keep Modal mounted with `visible` to avoid touch ghost after intro.
                  iOS: unmount when hidden — `visible={false}` on transparent modals can block taps. */}
              {Platform.OS === 'ios' ? (
                showAppIntro ? (
                  <Modal
                    visible
                    transparent={false}
                    animationType="fade"
                    onRequestClose={handleAppIntroDone}
                  >
                    <AppIntroScreen onDone={handleAppIntroDone} />
                  </Modal>
                ) : null
              ) : (
                <Modal
                  visible={showAppIntro}
                  transparent={false}
                  animationType="fade"
                  onRequestClose={handleAppIntroDone}
                >
                  {showAppIntro ? <AppIntroScreen onDone={handleAppIntroDone} /> : null}
                </Modal>
              )}
              <PilotLaunchNoticeModal
                visible={showPilotLaunchModal}
                onAcknowledge={acknowledgePilotLaunch}
              />
              <StatusBar style="dark" />
            </ThemeProvider>
          </AuthProvider>
        </StripeRoot>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
