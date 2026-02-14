import {
  DesignColors,
  DesignSpacing,
  DesignSizes,
} from '@/constants/design-template';
import { useAuth } from '@/contexts/AuthContext';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';

import OnboardingModal from '@/components/OnboardingModal';
import { SignInForm } from '@/components/SignInForm';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [profile, setProfile] = useState<{
    display_name: string | null;
    avatar_url: string | null;
    phone: string | null;
    expertise_level: string | null;
    experience_points: number | null;
    onboarding_completed: boolean | null;
    instructor_categories: string[] | null;
  } | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [savedVendors, setSavedVendors] = useState<{ id: string; name: string }[]>([]);
  const [workshopsAttended, setWorkshopsAttended] = useState(0);
  const [reviewsCount, setReviewsCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    supabase
      .from('profiles')
      .select('display_name, avatar_url, phone, expertise_level, experience_points, onboarding_completed, instructor_categories')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setProfile(data ?? null);
        setProfileLoaded(true);
      });

    supabase
      .from('user_vendor_saves')
      .select('vendor_id')
      .eq('user_id', user.id)
      .then(async ({ data: saves }) => {
        if (!saves?.length) return setSavedVendors([]);
        const ids = saves.map((s) => s.vendor_id).filter(Boolean);
        const { data: vendorList } = await supabase
          .from('vendors')
          .select('id, name')
          .in('id', ids);
        setSavedVendors(vendorList ?? []);
      });

    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'attended')
      .then(({ count }) => setWorkshopsAttended(count ?? 0));

    supabase
      .from('vendor_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => setReviewsCount(count ?? 0));
  }, [user?.id]);

  const showOnboarding = user && profileLoaded && profile?.onboarding_completed === false;

  const refreshProfile = () => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('display_name, avatar_url, phone, expertise_level, experience_points, onboarding_completed, instructor_categories')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setProfile(data ?? null));
  };

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: DesignColors.mediumGray }}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return <SignInForm />;
  }

  const displayName =
    profile?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    String(user.email ?? '').split('@')[0] ||
    '—';
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url;
  const email = user.email || '—';
  const phone = profile?.phone || '—';
  const level = profile?.expertise_level || 'Novice';
  const points = profile?.experience_points ?? 0;

  return (
    <>
      {showOnboarding && (
        <OnboardingModal userId={user.id} onComplete={refreshProfile} />
      )}
      <ScrollView
        style={{ flex: 1, backgroundColor: DesignColors.creamBg }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: DesignSpacing.contentPaddingTop,
          paddingBottom: DesignSpacing.contentPaddingBottom,
          paddingHorizontal: DesignSpacing.horizontalPadding,
        }}
      >
      {/* Logo – aligned with other pages */}
      <View style={{ marginLeft: DesignSpacing.logoMarginLeft, paddingLeft: 0, marginBottom: 24 }}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={{ height: DesignSizes.logoHeight, width: DesignSizes.logoWidth }}
          contentFit="contain"
        />
      </View>

      {/* Profile picture – circular, centered */}
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: DesignColors.placeholderGray,
          alignSelf: 'center',
          marginBottom: 12,
          overflow: 'hidden',
        }}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: 96, height: 96 }}
            contentFit="cover"
          />
        ) : null}
      </View>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          color: DesignColors.charcoal,
          textAlign: 'center',
          marginBottom: 4,
        }}
      >
        {displayName}
      </Text>
      <Text
        style={{
          fontSize: 15,
          color: DesignColors.primary,
          textAlign: 'center',
          marginBottom: 20,
        }}
      >
        {level}
        {level !== 'Master' && typeof points === 'number' ? ` • ${points} pts` : ''}
      </Text>

      {/* Stats row – horizontal, with dividers */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingVertical: 16,
          marginBottom: 20,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: DesignColors.lightGreenBorder,
        }}
      >
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal }}>{workshopsAttended}</Text>
          <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginTop: 2 }}>Workshops</Text>
        </View>
        <View style={{ width: 1, height: 32, backgroundColor: DesignColors.lightGreenBorder }} />
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal }}>{savedVendors.length}</Text>
          <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginTop: 2 }}>Saved</Text>
        </View>
        <View style={{ width: 1, height: 32, backgroundColor: DesignColors.lightGreenBorder }} />
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal }}>{reviewsCount}</Text>
          <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginTop: 2 }}>Reviews</Text>
        </View>
      </View>

      {/* Action buttons – Sign out + Share Profile (outline) */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
        <Pressable
          onPress={() => signOut()}
          style={{
            flex: 1,
            paddingVertical: DesignSpacing.ctaPaddingVertical,
            borderRadius: 9999,
            backgroundColor: '#B91C1C',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFF' }}>Sign out</Text>
        </Pressable>
        <Pressable
          style={{
            flex: 1,
            paddingVertical: DesignSpacing.ctaPaddingVertical,
            borderRadius: 9999,
            backgroundColor: DesignColors.creamBg,
            borderWidth: 1,
            borderColor: DesignColors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: DesignColors.primary }}>Share Profile</Text>
        </Pressable>
      </View>

      {/* Account details – Name, Email, Phone (existing content) */}
      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: DesignColors.charcoal,
          marginBottom: 12,
        }}
      >
        Account details
      </Text>
      <View
        style={{
          backgroundColor: '#FFF',
          borderRadius: DesignSpacing.heroCardBorderRadius,
          borderWidth: 1,
          borderColor: DesignColors.lightGreenBorder,
          padding: 20,
        }}
      >
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 4 }}>Name</Text>
          <Text style={{ fontSize: 16, color: DesignColors.charcoal }}>{displayName}</Text>
        </View>
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 4 }}>Email</Text>
          <Text style={{ fontSize: 16, color: DesignColors.charcoal }}>{email}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 4 }}>Phone number</Text>
          <Text style={{ fontSize: 16, color: DesignColors.charcoal }}>{phone}</Text>
        </View>
      </View>

      <Pressable
        onPress={() => {
          const base = (process.env.EXPO_PUBLIC_APP_URL || '').replace(/\/$/, '') || 'https://offhrs.com';
          Linking.openURL(`${base}/privacy`);
        }}
        style={{ marginTop: 20, paddingVertical: 12, alignItems: 'center' }}
      >
        <Text style={{ fontSize: 14, color: DesignColors.mediumGray }}>Privacy Policy</Text>
      </Pressable>
    </ScrollView>
    </>
  );
}
