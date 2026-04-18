import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';
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
  /** Avoid resetting to unknown on every effect run for the same user — that unmounted OnboardingModal and reset step state. */
  const prevOnboardingUserIdRef = useRef<string | null>(null);

  useEffect(() => {
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

  const handleOnboardingComplete = useCallback(() => {
    const uid = user?.id;
    if (!uid) return;
    setOnboardingStatus('complete');

    // Android: do not re-open onboarding from a follow-up read — stale rows after upsert caused the modal to repeat.
    // The modal only calls onComplete after a successful save; trust that and still refresh other screens.
    if (Platform.OS === 'android') {
      supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', uid)
        .single()
        .then(() => {
          emitProfileUpdated();
        })
        .catch(() => {
          emitProfileUpdated();
        });
      return;
    }

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

  const showOnboarding =
    !!user?.id && onboardingStatus === 'needs_onboarding';

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
        <OnboardingModal userId={user.id} onComplete={handleOnboardingComplete} />
      ) : null}
    </>
  );
}
