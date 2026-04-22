import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, useWindowDimensions, View } from 'react-native';
import {
  DocumentMagnifyingGlassIcon,
  EnvelopeIcon,
  HomeIcon,
  UserCircleIcon,
} from 'react-native-heroicons/solid';

import OnboardingModal from '@/components/OnboardingModal';
import { DesignColors, isIOSPad } from '@/constants/design-template';
import { useAuth } from '@/contexts/AuthContext';
import { emitProfileUpdated } from '@/lib/profile-events';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Android-only: persistent per-user onboarding completion cache. Survives any remount, auth
 *  cycle, or DB read race. Key is user-scoped so account switches get a fresh check. */
const ANDROID_ONBOARDING_DONE_KEY_PREFIX = '@offhrs/androidOnboardingDone/';
const androidOnboardingDoneKey = (userId: string) =>
  `${ANDROID_ONBOARDING_DONE_KEY_PREFIX}${userId}`;

/**
 * Android-only: module-scoped completion lock. Lives OUTSIDE the React component tree so it
 * survives TabLayout unmount/remount, navigation state cycles, React Strict Mode double-invocation,
 * Fabric reconciliation, and any other lifecycle reset. The only path that clears it is a genuine
 * account switch (a different userId signs in). Once set for a userId, the onboarding modal can
 * never reopen for that user in this app session.
 */
let moduleAndroidOnboardingDoneForUserId: string | null = null;

const TAB_BAR_BOTTOM_INSET_IPHONE = 28;
const TAB_ICON_SIZE = 24;

/** Same size as Browse Workshops button (index.tsx: HORIZONTAL_PADDING 24, paddingVertical 12) */
const HORIZONTAL_PADDING = 24;
const TAB_BAR_HEIGHT = 48;

/** White bar with green border; active icon circle and inactive icon tint */
const TAB_BAR_BG = '#FFFFFF';
const TAB_BAR_ACTIVE_BG = '#E8F0E5';
const INACTIVE_TINT = '#6B6B6B';

const ICON_WRAP_SIZE = 40;

const ICON_MAP: Record<string, typeof HomeIcon> = {
  index: HomeIcon,
  workshops: DocumentMagnifyingGlassIcon,
  contact: EnvelopeIcon,
  profile: UserCircleIcon,
};

function TabIcon({
  IconComponent,
  focused,
}: {
  IconComponent: typeof HomeIcon;
  focused: boolean;
}) {
  const color = focused ? DesignColors.primary : INACTIVE_TINT;
  return (
    <View
      style={{
        width: ICON_WRAP_SIZE,
        height: ICON_WRAP_SIZE,
        borderRadius: ICON_WRAP_SIZE / 2,
        backgroundColor: focused ? TAB_BAR_ACTIVE_BG : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconComponent size={TAB_ICON_SIZE} color={color} />
    </View>
  );
}

const ANDROID_SCENE_PADDING_BOTTOM = 132;

function CustomTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isIPad = isIOSPad();
  const barWidth = screenWidth - HORIZONTAL_PADDING * 2;
  const barLeft = (screenWidth - barWidth) / 2;
  const bottomInset =
    Platform.OS === 'ios'
      ? isIPad
        ? Math.max(insets.bottom, 20) + 10
        : TAB_BAR_BOTTOM_INSET_IPHONE
      : Math.max(insets.bottom, 12) + 4;

  const routes = state.routes.filter((r) => r.name !== 'explore');

  return (
    <View
      style={{
        position: 'absolute',
        left: barLeft,
        bottom: bottomInset,
        width: barWidth,
        height: TAB_BAR_HEIGHT,
        borderRadius: TAB_BAR_HEIGHT / 2,
        backgroundColor: TAB_BAR_BG,
        borderWidth: 1,
        borderColor: DesignColors.primary,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
      }}
    >
      {routes.map((route, index) => {
        const focused = state.index === index;
        const IconComponent = ICON_MAP[route.name];
        const onPress = () => {
          if (Platform.OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={{
              flex: 1,
              height: TAB_BAR_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {IconComponent ? (
              <TabIcon IconComponent={IconComponent} focused={focused} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const IOS_SCENE_PADDING_BOTTOM = 84;
const IOS_SCENE_PADDING_BOTTOM_IPAD = 112;

/** True only when onboarding is explicitly finished; false and null mean show onboarding. */
function profileNeedsOnboarding(
  onboarding_completed: boolean | null | undefined
): boolean {
  return onboarding_completed !== true;
}

export default function TabLayout() {
  const isIPad = isIOSPad();
  const { user } = useAuth();
  const [onboardingStatus, setOnboardingStatus] = useState<
    'unknown' | 'needs_onboarding' | 'complete'
  >('unknown');
  /** Tracks the last seen userId to detect account switches. Used by both iOS and Android effects. */
  const prevOnboardingUserIdRef = useRef<string | null>(null);
  /**
   * Android: userId for whom onboarding was confirmed complete via handleOnboardingComplete.
   * Set synchronously before any async work so that any in-flight SELECT can detect completion
   * and skip overriding the status with stale data.
   */
  const completedForUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    if (!user?.id) {
      prevOnboardingUserIdRef.current = null;
      setOnboardingStatus('unknown');
      return;
    }
    const userId = user.id;
    const switchedAccount = prevOnboardingUserIdRef.current !== userId;
    prevOnboardingUserIdRef.current = userId;

    if (switchedAccount) {
      setOnboardingStatus('unknown');
    }

    let cancelled = false;
    supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (!cancelled) {
          if (error || !data) {
            // Fail-open: do not block tabs/profile if onboarding status is temporarily unavailable.
            setOnboardingStatus('unknown');
            return;
          }
          setOnboardingStatus(
            profileNeedsOnboarding(data.onboarding_completed) ? 'needs_onboarding' : 'complete'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (Platform.OS === 'ios') return;

    if (!user?.id) {
      prevOnboardingUserIdRef.current = null;
      completedForUserIdRef.current = null;
      setOnboardingStatus('unknown');
      return;
    }

    const userId = user.id;

    // DEFINITIVE GUARD (module-scoped): survives any remount of TabLayout, any React ref reset,
    // any auth cycle, and any navigation storm. Checked FIRST — before switchedAccount detection,
    // before AsyncStorage, before the DB SELECT — so no stale read can ever flip the state back
    // to needs_onboarding for a user whose onboarding already completed in this app session.
    if (moduleAndroidOnboardingDoneForUserId === userId) {
      prevOnboardingUserIdRef.current = userId;
      completedForUserIdRef.current = userId;
      setOnboardingStatus('complete');
      return;
    }

    const prev = prevOnboardingUserIdRef.current;
    const switchedAccount = prev !== null && prev !== userId;
    prevOnboardingUserIdRef.current = userId;

    if (switchedAccount) {
      completedForUserIdRef.current = null;
      // Clear module lock — the ONLY path that clears it. A genuine account switch means a
      // different userId has signed in, so this new user must go through the fresh check.
      moduleAndroidOnboardingDoneForUserId = null;
      setOnboardingStatus('unknown');
      // Clear the previous user's persistent cache so we don't leak completion status
      // across account switches. New user's key will be written on their own completion.
      if (prev) {
        AsyncStorage.removeItem(androidOnboardingDoneKey(prev)).catch(() => {
          /* ignore */
        });
      }
    }

    // In-session cache: skip DB round-trip if handleOnboardingComplete already confirmed.
    if (completedForUserIdRef.current === userId) {
      setOnboardingStatus('complete');
      return;
    }

    let cancelled = false;

    // Android: check persistent AsyncStorage cache FIRST. If onboarding was completed on this
    // device for this user (even in a previous app session), never show the modal again.
    // This is the definitive guard — it survives remounts, auth cycles, DB replication lag,
    // and any in-memory ref being cleared. Only a real account switch clears this.
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(androidOnboardingDoneKey(userId));
        if (cancelled) return;
        if (cached === 'true') {
          // Re-establish module lock on app restart: the first AsyncStorage hit repopulates it
          // so subsequent remounts in this session short-circuit at the top of the effect.
          moduleAndroidOnboardingDoneForUserId = userId;
          completedForUserIdRef.current = userId;
          setOnboardingStatus('complete');
          return;
        }
      } catch {
        // Fall through to DB check on storage errors.
      }

      if (cancelled) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', userId)
        .single();

      if (cancelled) return;
      // Guard against stale reads overriding a just-completed onboarding.
      if (completedForUserIdRef.current === userId) return;
      if (moduleAndroidOnboardingDoneForUserId === userId) return;

      if (error || !data) {
        setOnboardingStatus('unknown');
        return;
      }

      if (!profileNeedsOnboarding(data.onboarding_completed)) {
        // Cache completion locally so we never re-check from DB for this user on this device.
        try {
          await AsyncStorage.setItem(androidOnboardingDoneKey(userId), 'true');
        } catch {
          /* ignore */
        }
        if (cancelled) return;
        // Re-establish module lock from DB success: on app restart (or first ever check for
        // a user who completed onboarding on another device), this seals the lock.
        moduleAndroidOnboardingDoneForUserId = userId;
        completedForUserIdRef.current = userId;
        setOnboardingStatus('complete');
      } else {
        setOnboardingStatus('needs_onboarding');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleOnboardingComplete = useCallback(() => {
    const uid = user?.id ?? prevOnboardingUserIdRef.current;

    if (Platform.OS === 'android') {
      // MOST IMPORTANT LINE IN THE FILE: set the module-level lock SYNCHRONOUSLY, before any
      // setState or async work. Once this is set, the onboarding modal cannot reopen for this
      // user in this app session — not via remount, not via stale SELECT, not via auth churn.
      if (uid) moduleAndroidOnboardingDoneForUserId = uid;

      setOnboardingStatus('complete');

      // Set in-memory ref synchronously so any in-flight SELECT in this session skips its update.
      if (uid) {
        completedForUserIdRef.current = uid;
        // Persist completion to AsyncStorage so the modal never reopens on this device for this
        // user, regardless of remounts, auth cycles, or DB read anomalies. Fire-and-forget.
        AsyncStorage.setItem(androidOnboardingDoneKey(uid), 'true').catch(() => {
          /* ignore — worst case the next session does a fresh DB check */
        });
      }
      emitProfileUpdated();
      return;
    }

    setOnboardingStatus('complete');

    // iOS path — unchanged: verify the DB write then emit.
    supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', uid)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          emitProfileUpdated();
          return;
        }
        if (profileNeedsOnboarding(data.onboarding_completed)) {
          setOnboardingStatus('needs_onboarding');
        } else {
          setOnboardingStatus('complete');
        }
        emitProfileUpdated();
      })
      .catch(() => {
        emitProfileUpdated();
      });
  }, [user?.id]);

  const showOnboarding = !!user?.id && onboardingStatus === 'needs_onboarding';

  return (
    <>
      <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: DesignColors.primary,
        tabBarInactiveTintColor: INACTIVE_TINT,
        headerShown: false,
        tabBarShowLabel: false,
        sceneContainerStyle: {
          paddingBottom:
            Platform.OS === 'ios'
              ? isIPad
                ? IOS_SCENE_PADDING_BOTTOM_IPAD
                : IOS_SCENE_PADDING_BOTTOM
              : ANDROID_SCENE_PADDING_BOTTOM,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon IconComponent={HomeIcon} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="workshops"
        options={{
          title: 'Workshops',
          tabBarIcon: ({ focused }) => (
            <TabIcon IconComponent={DocumentMagnifyingGlassIcon} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="contact"
        options={{
          title: 'Contact',
          tabBarIcon: ({ focused }) => (
            <TabIcon IconComponent={EnvelopeIcon} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon IconComponent={UserCircleIcon} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
      {showOnboarding ? (
        <OnboardingModal
          userId={user!.id}
          onComplete={handleOnboardingComplete}
        />
      ) : null}
    </>
  );
}
