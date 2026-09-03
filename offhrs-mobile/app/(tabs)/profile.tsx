import {
  DesignColors,
  DesignSpacing,
  DesignSizes,
} from '@/constants/design-template';
import { useAuth } from '@/contexts/AuthContext';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity as RNTouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SignInForm } from '@/components/SignInForm';
import { openWebAppPath } from '@/lib/web-app-links';
import { parseCanadianPostalCode } from '@/lib/canadianPostalCode';
import { subscribeEventSavesChanged } from '@/lib/event-saves';
import { normalizeProfilePhone } from '@/lib/profile-phone';
import { geocodeAddress, reverseGeocodeCanadianPostal } from '@/lib/geocode';
import { deleteAuthenticatedUserAccount } from '@/lib/delete-account';
import { createShopOrderClaim, fetchShopOrders, formatShopOrderStatus, shopOrderCanClaim, type ShopOrderListItem } from '@/lib/shop-api';
import { emitProfileUpdated, PROFILE_UPDATED_EVENT } from '@/lib/profile-events';
import { BOOK_API_BASE } from '@/constants/api';
import { buildBookingApiHeaders } from '@/lib/booking-api-headers';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STATS_DIVIDER_WIDTH = 1;

type ProfileLocationUpsert = {
  postal_code: string | null;
  location_lat: number | null;
  location_lng: number | null;
};

/** Upsert so location/postal persist even if the profiles row was missing; avoids silent no-op from UPDATE 0 rows. */
async function upsertProfileLocation(userId: string, loc: ProfileLocationUpsert) {
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      postal_code: loc.postal_code,
      location_lat: loc.location_lat,
      location_lng: loc.location_lng,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  return error;
}

export default function ProfileScreen() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const [profile, setProfile] = useState<{
    display_name: string | null;
    avatar_url: string | null;
    expertise_level: string | null;
    experience_points: number | null;
    onboarding_completed: boolean | null;
    instructor_categories: string[] | null;
    postal_code: string | null;
    location_lat: number | null;
    location_lng: number | null;
    phone: string | null;
  } | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [savedEventsCount, setSavedEventsCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [savedModalVisible, setSavedModalVisible] = useState(false);
  const [savedEvents, setSavedEvents] = useState<{
    id: number;
    title: string;
    date: string;
    location: string;
    vendor_id: string | null;
    vendor_profile_id: string | null;
    vendor_name: string | null;
  }[]>([]);
  const [savedEventsLoading, setSavedEventsLoading] = useState(false);
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false);
  const [ordersModalVisible, setOrdersModalVisible] = useState(false);
  const [shopOrders, setShopOrders] = useState<ShopOrderListItem[]>([]);
  const [shopOrdersLoading, setShopOrdersLoading] = useState(false);
  const [myReviews, setMyReviews] = useState<{ id: string; vendor_id: string; vendor_name: string; rating: number; comment: string | null; created_at: string }[]>([]);
  const [myReviewsLoading, setMyReviewsLoading] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [settingsEmail, setSettingsEmail] = useState('');
  const [settingsPhone, setSettingsPhone] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsLocationPostal, setSettingsLocationPostal] = useState('');
  const [settingsLocationAction, setSettingsLocationAction] = useState<null | 'postal' | 'gps' | 'clear'>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const savedModalVisibleRef = useRef(false);
  const insets = useSafeAreaInsets();
  savedModalVisibleRef.current = savedModalVisible;

  useEffect(() => {
    if (!user?.id) return;

    supabase
      .from('profiles')
      .select(
        'display_name, avatar_url, expertise_level, experience_points, onboarding_completed, instructor_categories, postal_code, location_lat, location_lng, phone'
      )
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setProfile(data ?? null);
        setProfileLoaded(true);
      });

    supabase
      .from('user_event_saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => setSavedEventsCount(count ?? 0));

    supabase
      .from('vendor_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => setReviewsCount(count ?? 0));

    fetchShopOrders()
      .then((orders) => setOrdersCount(orders.length))
      .catch(() => setOrdersCount(0));
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;

      const refetchProfileAndCounts = () => {
        supabase
          .from('user_event_saves')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .then(({ count }) => setSavedEventsCount(count ?? 0));
        supabase
          .from('vendor_reviews')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .then(({ count }) => setReviewsCount(count ?? 0));
        fetchShopOrders()
          .then((orders) => setOrdersCount(orders.length))
          .catch(() => setOrdersCount(0));
        supabase
          .from('profiles')
          .select(
            'display_name, avatar_url, expertise_level, experience_points, onboarding_completed, instructor_categories, postal_code, location_lat, location_lng, phone'
          )
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data);
          });
      };

      refetchProfileAndCounts();

      void (async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const headers = await buildBookingApiHeaders(token);
        await fetch(`${BOOK_API_BASE}/api/attendance/credit-due`, {
          method: 'POST',
          headers,
        }).catch(() => {});
        refetchProfileAndCounts();
      })();
    }, [user?.id])
  );

  const fetchSavedEvents = useCallback(async () => {
    if (!user?.id) return;
    setSavedEventsLoading(true);
    const { data: saves } = await supabase
      .from('user_event_saves')
      .select('event_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!saves?.length) {
      setSavedEvents([]);
      setSavedEventsCount(0);
      setSavedEventsLoading(false);
      return;
    }
    const eventIds = saves.map((s) => s.event_id).filter((id): id is number => id != null);
    const { data: events } = await supabase
      .from('events')
      .select('id, title, date, location, vendor_id, vendor_profile_id')
      .in('id', eventIds);
    if (!events?.length) {
      setSavedEvents([]);
      setSavedEventsCount(0);
      setSavedEventsLoading(false);
      return;
    }
    const orderById = Object.fromEntries(eventIds.map((id, i) => [id, i]));
    const sortedEvents = [...events].sort((a, b) => (orderById[a.id] ?? 0) - (orderById[b.id] ?? 0));
    const vendorIds = [...new Set(events.map((e) => e.vendor_id).filter(Boolean))] as string[];
    const { data: vendors } = vendorIds.length
      ? await supabase.from('vendors').select('id, name').in('id', vendorIds)
      : { data: [] };
    const nameById = Object.fromEntries((vendors ?? []).map((v) => [v.id, v.name ?? 'Vendor']));
    const list = sortedEvents.map((e) => ({
      id: e.id,
      title: e.title ?? 'Workshop',
      date: e.date ?? '',
      location: e.location ?? '',
      vendor_id: e.vendor_id ?? null,
      vendor_profile_id: (e as { vendor_profile_id?: string | null }).vendor_profile_id ?? null,
      vendor_name: e.vendor_id ? (nameById[e.vendor_id] ?? null) : null,
    }));
    setSavedEvents(list);
    setSavedEventsCount(list.length);
    setSavedEventsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    return subscribeEventSavesChanged(({ eventId, saved }) => {
      setSavedEventsCount((c) => Math.max(0, c + (saved ? 1 : -1)));
      setSavedEvents((prev) => {
        if (!saved) return prev.filter((e) => e.id !== eventId);
        return prev;
      });
      if (saved && savedModalVisibleRef.current) {
        void fetchSavedEvents();
      }
    });
  }, [fetchSavedEvents]);

  const fetchMyReviews = useCallback(async () => {
    if (!user?.id) return;
    setMyReviewsLoading(true);
    const { data: reviews } = await supabase
      .from('vendor_reviews')
      .select('id, vendor_id, rating, comment, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!reviews?.length) {
      setMyReviews([]);
      setMyReviewsLoading(false);
      return;
    }
    const vendorIds = [...new Set(reviews.map((r) => r.vendor_id))];
    const { data: vendors } = await supabase.from('vendors').select('id, name').in('id', vendorIds);
    const nameById = Object.fromEntries((vendors ?? []).map((v) => [v.id, v.name ?? 'Vendor']));
    setMyReviews(
      (reviews ?? []).map((r) => ({
        id: r.id,
        vendor_id: r.vendor_id,
        vendor_name: nameById[r.vendor_id] ?? 'Vendor',
        rating: r.rating,
        comment: r.comment ?? null,
        created_at: r.created_at,
      }))
    );
    setMyReviewsLoading(false);
  }, [user?.id]);

  const fetchShopOrdersList = useCallback(async () => {
    if (!user?.id) return;
    setShopOrdersLoading(true);
    try {
      const orders = await fetchShopOrders();
      setShopOrders(orders);
      setOrdersCount(orders.length);
    } catch {
      setShopOrders([]);
    } finally {
      setShopOrdersLoading(false);
    }
  }, [user?.id]);

  const refreshProfile = useCallback(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select(
        'display_name, avatar_url, expertise_level, experience_points, onboarding_completed, instructor_categories, postal_code, location_lat, location_lng, phone'
      )
      .eq('id', user.id)
      .single()
      .then(({ data }) => setProfile(data ?? null));
  }, [user?.id]);

  const runDeleteAccount = useCallback(async () => {
    setDeletingAccount(true);
    try {
      const result = await deleteAuthenticatedUserAccount();
      if (!result.ok) {
        Alert.alert('Could not delete account', result.error);
        return;
      }
      setSettingsVisible(false);
      setProfile(null);
      setProfileLoaded(false);
      await signOut();
      router.replace('/(tabs)/profile');
    } catch (error) {
      Alert.alert(
        'Could not delete account',
        error instanceof Error ? error.message : 'Something went wrong'
      );
    } finally {
      setDeletingAccount(false);
    }
  }, [router, signOut]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(PROFILE_UPDATED_EVENT, () => {
      refreshProfile();
    });
    return () => sub.remove();
  }, [refreshProfile]);

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: DesignColors.mediumGray }}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return <SignInForm showHeaderLogo />;
  }

  const displayName =
    profile?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    String(user.email ?? '').split('@')[0] ||
    '—';
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const email = user.email || '—';

  const memberSinceLabel = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const statsRowInnerWidth = windowWidth - DesignSpacing.horizontalPadding * 2;
  const statsCellWidth = (statsRowInnerWidth - STATS_DIVIDER_WIDTH * 2) / 3;

  return (
    <>
      <ScrollView
        ref={scrollViewRef}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: DesignColors.creamBg }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: DesignSpacing.contentPaddingTop,
          // Native: safe area + room above floating tab bar / Sign out (Android keeps prior 168px floor)
          paddingBottom:
            Platform.OS === 'web'
              ? DesignSpacing.contentPaddingBottom
              : Platform.OS === 'android'
                ? Math.max(168, Math.max(insets.bottom, 12) + 96)
                : Math.max(insets.bottom, 12) + 96,
          paddingHorizontal: DesignSpacing.horizontalPadding,
        }}
      >
      {/* Top bar: logo left, Settings right */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: Platform.OS === 'android' ? 16 : 24,
        }}
      >
        <View style={{ marginLeft: DesignSpacing.logoMarginLeft, paddingLeft: 0 }}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={{ height: DesignSizes.logoHeight, width: DesignSizes.logoWidth }}
            contentFit="contain"
          />
        </View>
        <Pressable
          onPress={() => {
            setSettingsName(displayName === '—' ? '' : displayName);
            setSettingsEmail(email === '—' ? '' : email);
            setSettingsPhone(profile?.phone?.trim() ?? '');
            setSettingsLocationPostal(profile?.postal_code ?? '');
            setSettingsError(null);
            setSettingsVisible(true);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 9999,
            backgroundColor: DesignColors.creamBg,
            borderWidth: 1,
            borderColor: DesignColors.lightGreenBorder,
          }}
        >
          <MaterialCommunityIcons name="cog" size={20} color={DesignColors.primary} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.primary }}>Settings</Text>
        </Pressable>
      </View>

      {/* Profile picture – circular, centered */}
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: DesignColors.primary,
          alignSelf: 'center',
          marginBottom: Platform.OS === 'android' ? 8 : 12,
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: 96, height: 96 }}
            contentFit="cover"
          />
        ) : (
          <Text style={{ fontSize: 36, fontWeight: '700', color: '#FFFFFF' }}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          color: DesignColors.charcoal,
          textAlign: 'center',
          marginBottom: memberSinceLabel ? (Platform.OS === 'android' ? 6 : 8) : Platform.OS === 'android' ? 12 : 20,
        }}
      >
        {displayName}
      </Text>
      {memberSinceLabel ? (
        <Text
          style={{
            fontSize: 14,
            color: DesignColors.mediumGray,
            textAlign: 'center',
            marginBottom: Platform.OS === 'android' ? 12 : 16,
          }}
        >
          Member since {memberSinceLabel}
        </Text>
      ) : null}

      {/* Stats row – fixed equal widths so dividers are centered between columns (iOS + Android) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'stretch',
          justifyContent: 'center',
          width: '100%',
          paddingVertical: 16,
          marginBottom: Platform.OS === 'android' ? 14 : 20,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: DesignColors.lightGreenBorder,
        }}
      >
        <RNTouchableOpacity
          style={{
            width: statsCellWidth,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={() => {
            setOrdersModalVisible(true);
            fetchShopOrdersList();
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal }}>{ordersCount}</Text>
          <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginTop: 2 }}>Orders</Text>
        </RNTouchableOpacity>
        <View
          style={{
            width: STATS_DIVIDER_WIDTH,
            alignSelf: 'center',
            height: 32,
            backgroundColor: DesignColors.lightGreenBorder,
          }}
        />
        <RNTouchableOpacity
          style={{
            width: statsCellWidth,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={() => {
            setSavedModalVisible(true);
            fetchSavedEvents();
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal }}>{savedEventsCount}</Text>
          <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginTop: 2 }}>Saved</Text>
        </RNTouchableOpacity>
        <View
          style={{
            width: STATS_DIVIDER_WIDTH,
            alignSelf: 'center',
            height: 32,
            backgroundColor: DesignColors.lightGreenBorder,
          }}
        />
        <RNTouchableOpacity
          style={{
            width: statsCellWidth,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={() => {
            setReviewsModalVisible(true);
            fetchMyReviews();
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal }}>{reviewsCount}</Text>
          <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginTop: 2 }}>Reviews</Text>
        </RNTouchableOpacity>
      </View>

      {/* Account details – Name, Email, Phone */}
      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: DesignColors.charcoal,
          marginBottom: Platform.OS === 'android' ? 8 : 12,
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
          padding: Platform.OS === 'android' ? 14 : 20,
        }}
      >
        <View style={{ marginBottom: Platform.OS === 'android' ? 12 : 16 }}>
          <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 4 }}>Name</Text>
          <Text style={{ fontSize: 16, color: DesignColors.charcoal }}>{displayName}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 4 }}>Email</Text>
          <Text style={{ fontSize: 16, color: DesignColors.charcoal }}>{email}</Text>
        </View>
      </View>

      <Pressable
        onPress={() => router.push('/contact')}
        accessibilityRole="button"
        accessibilityLabel="Contact us"
        style={{
          marginTop: 16,
          paddingVertical: 14,
          borderRadius: 9999,
          borderWidth: 1,
          borderColor: DesignColors.lightGreenBorder,
          backgroundColor: DesignColors.inputBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '600', color: DesignColors.primary }}>
          Contact us
        </Text>
      </Pressable>

      {/* Consent footer: same wording as the signed-out sign-in form so users
          always see how to reach the consolidated Terms overview. */}
      <View
        style={{
          marginTop: 16,
          paddingVertical: 8,
          paddingHorizontal: 4,
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 11,
            color: DesignColors.mediumGray,
            lineHeight: 16,
          }}
        >
          By continuing you agree to our{' '}
        </Text>
        <Pressable
          onPress={() => void openWebAppPath('/terms')}
          accessibilityRole="link"
          accessibilityLabel="Terms and Policies"
          hitSlop={4}
        >
          <Text
            style={{
              color: DesignColors.primary,
              fontSize: 11,
              fontWeight: '600',
              lineHeight: 16,
            }}
          >
            Terms & Policies
          </Text>
        </Pressable>
        <Text
          style={{
            fontSize: 11,
            color: DesignColors.mediumGray,
            lineHeight: 16,
          }}
        >
          .
        </Text>
      </View>

      <Pressable
        onPress={() => signOut()}
        style={{
          marginTop: 16,
          marginBottom: 8,
          paddingVertical: DesignSpacing.ctaPaddingVertical,
          borderRadius: 9999,
          backgroundColor: '#B91C1C',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFF' }}>Sign out</Text>
      </Pressable>
    </ScrollView>

      {/* My reviews modal – list of reviews by vendor */}
      <Modal
        visible={reviewsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewsModalVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onPress={() => setReviewsModalVisible(false)}
        >
          <Pressable
            style={{
              width: '100%',
              maxWidth: 400,
              maxHeight: '80%',
              backgroundColor: '#FFF',
              borderRadius: 20,
              overflow: 'hidden',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: DesignColors.lightGreenBorder,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal }}>Your reviews</Text>
              <RNTouchableOpacity onPress={() => setReviewsModalVisible(false)} style={{ padding: 8 }} activeOpacity={0.7}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: DesignColors.primary }}>Close</Text>
              </RNTouchableOpacity>
            </View>
            {myReviewsLoading ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={DesignColors.primary} />
                <Text style={{ marginTop: 12, fontSize: 14, color: DesignColors.mediumGray }}>Loading...</Text>
              </View>
            ) : myReviews.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: DesignColors.mediumGray, textAlign: 'center' }}>
                  You haven&apos;t written any reviews yet.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ paddingBottom: 24 }}>
                {myReviews.map((r) => (
                  <RNTouchableOpacity
                    key={r.id}
                    onPress={() => {
                      setReviewsModalVisible(false);
                      router.push(`/vendors/${r.vendor_id}`);
                    }}
                    activeOpacity={0.7}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      borderBottomWidth: myReviews.indexOf(r) < myReviews.length - 1 ? 1 : 0,
                      borderBottomColor: DesignColors.lightGreenBorder,
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '600', color: DesignColors.charcoal }}>{r.vendor_name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Text style={{ fontSize: 13, color: DesignColors.mediumGray }}>
                        {r.rating} star{r.rating !== 1 ? 's' : ''}
                      </Text>
                      <Text style={{ fontSize: 12, color: DesignColors.mediumGray, marginLeft: 8 }}>
                        {r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                      </Text>
                    </View>
                    {r.comment ? (
                      <Text style={{ fontSize: 13, color: DesignColors.charcoal, marginTop: 6 }} numberOfLines={3}>
                        {r.comment}
                      </Text>
                    ) : null}
                    <Text style={{ fontSize: 12, color: DesignColors.primary, marginTop: 6 }}>View vendor →</Text>
                  </RNTouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Shop orders modal — Profile → Orders */}
      <Modal
        visible={ordersModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOrdersModalVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onPress={() => setOrdersModalVisible(false)}
        >
          <Pressable
            style={{
              width: '100%',
              maxWidth: 400,
              maxHeight: '80%',
              backgroundColor: '#FFF',
              borderRadius: 20,
              overflow: 'hidden',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: DesignColors.lightGreenBorder,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal }}>Orders</Text>
              <Pressable onPress={() => setOrdersModalVisible(false)} style={{ padding: 8 }}>
                <MaterialCommunityIcons name="close" size={22} color={DesignColors.charcoal} />
              </Pressable>
            </View>
            {shopOrdersLoading ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <ActivityIndicator color={DesignColors.primary} />
              </View>
            ) : shopOrders.length === 0 ? (
              <View style={{ padding: 32 }}>
                <Text style={{ textAlign: 'center', color: DesignColors.mediumGray }}>
                  No shop orders yet. Browse the Shop tab to find maker goods.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {shopOrders.map((o) => (
                  <Pressable
                    key={o.id}
                    onPress={() => {
                      setOrdersModalVisible(false);
                      router.push(`/shop/${o.product_id}`);
                    }}
                    style={{
                      padding: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: DesignColors.lightGreenBorder,
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '600', color: DesignColors.charcoal }}>
                      {o.product_title}
                    </Text>
                    <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginTop: 4 }}>
                      {o.vendor_name} · ${o.total_cad.toFixed(2)} CAD
                    </Text>
                    <Text style={{ fontSize: 12, color: DesignColors.mediumGray, marginTop: 4 }}>
                      {o.fulfillment_type === 'pickup' ? 'Pickup' : 'Shipping'} · {formatShopOrderStatus(o)}
                    </Text>
                    {o.tracking_number ? (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          if (o.tracking_url) void Linking.openURL(o.tracking_url);
                        }}
                      >
                        <Text style={{ fontSize: 12, color: DesignColors.primary, marginTop: 4, fontWeight: '600' }}>
                          {o.tracking_url ? `Track ${o.tracking_number}` : `Tracking ${o.tracking_number}`}
                        </Text>
                      </Pressable>
                    ) : null}
                    {shopOrderCanClaim(o) ? (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          const submitClaim = async (text: string) => {
                            if (!text || text.trim().length < 10) {
                              Alert.alert('Please enter at least 10 characters.');
                              return;
                            }
                            try {
                              await createShopOrderClaim(o.id, {
                                reason: 'snad',
                                description: text.trim(),
                              });
                              Alert.alert('Claim submitted', 'We’ll review this with the maker.');
                            } catch (err) {
                              Alert.alert(
                                'Could not submit',
                                err instanceof Error ? err.message : 'Try again later'
                              );
                            }
                          };
                          if (Platform.OS === 'ios' && typeof Alert.prompt === 'function') {
                            Alert.prompt(
                              'Report a problem',
                              'Describe the issue (damaged / not as described).',
                              (text) => {
                                void submitClaim(text ?? '');
                              }
                            );
                            return;
                          }
                          Alert.alert(
                            'Report a problem',
                            'Email hello@offhrs.app with your order ID and photos (damaged / not as described). Claims must be within 14 days of delivery.'
                          );
                        }}
                      >
                        <Text style={{ fontSize: 12, color: DesignColors.primary, marginTop: 6, fontWeight: '600' }}>
                          Report a problem
                        </Text>
                      </Pressable>
                    ) : null}
                    <Text style={{ fontSize: 12, color: DesignColors.primary, marginTop: 6, fontWeight: '600' }}>
                      View item →
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Saved events modal – list of saved events, opened from Saved stat card */}
      <Modal
        visible={savedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSavedModalVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onPress={() => setSavedModalVisible(false)}
        >
          <Pressable
            style={{
              width: '100%',
              maxWidth: 400,
              maxHeight: '80%',
              backgroundColor: '#FFF',
              borderRadius: 20,
              overflow: 'hidden',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: DesignColors.lightGreenBorder,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal }}>Saved events</Text>
              <Pressable onPress={() => setSavedModalVisible(false)} style={{ padding: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: DesignColors.primary }}>Close</Text>
              </Pressable>
            </View>
            {savedEventsLoading ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={DesignColors.primary} />
                <Text style={{ marginTop: 12, fontSize: 14, color: DesignColors.mediumGray }}>Loading...</Text>
              </View>
            ) : savedEvents.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: DesignColors.mediumGray, textAlign: 'center' }}>
                  No saved events yet. Tap the heart on a workshop to save it for later.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ paddingBottom: 24 }}>
                {savedEvents.map((e) => (
                  <Pressable
                    key={e.id}
                    onPress={() => {
                      setSavedModalVisible(false);
                      if (e.vendor_id) {
                        router.push(
                          e.vendor_profile_id
                            ? `/vendors/${e.vendor_id}?eventId=${e.id}&vendorProfileId=${encodeURIComponent(e.vendor_profile_id)}`
                            : `/vendors/${e.vendor_id}?eventId=${e.id}`
                        );
                      }
                    }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      borderBottomWidth: savedEvents.indexOf(e) < savedEvents.length - 1 ? 1 : 0,
                      borderBottomColor: DesignColors.lightGreenBorder,
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '600', color: DesignColors.charcoal }}>{e.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 8 }}>
                      {e.date ? (
                        <Text style={{ fontSize: 13, color: DesignColors.mediumGray }}>
                          {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      ) : null}
                      {e.vendor_name ? (
                        <Text style={{ fontSize: 13, color: DesignColors.mediumGray }}>{e.vendor_name}</Text>
                      ) : null}
                    </View>
                    {e.vendor_id ? (
                      <Text style={{ fontSize: 12, color: DesignColors.primary, marginTop: 6 }}>View workshop →</Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Settings modal – edit Name, Email, Phone */}
      <Modal
        visible={settingsVisible}
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
        onDismiss={() => setSettingsVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: DesignColors.creamBg }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: DesignSpacing.horizontalPadding,
              paddingTop: DesignSpacing.contentPaddingTop,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: DesignColors.lightGreenBorder,
              backgroundColor: '#FFF',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal }}>Account settings</Text>
            <Pressable onPress={() => setSettingsVisible(false)} style={{ padding: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: DesignColors.primary }}>Cancel</Text>
            </Pressable>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: DesignSpacing.horizontalPadding,
              paddingTop: 24,
              // Android: system nav / gesture bar sits under modal content; extra inset so "Delete my account" scrolls clear.
              paddingBottom:
                Platform.OS === 'android' ? 32 + insets.bottom + 48 : 32,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 6 }}>Name</Text>
            <TextInput
              value={settingsName}
              onChangeText={setSettingsName}
              placeholder="Your name"
              placeholderTextColor={DesignColors.mediumGray}
              style={{
                backgroundColor: DesignColors.inputBg,
                borderWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                color: DesignColors.charcoal,
                marginBottom: 20,
              }}
            />
            <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 6 }}>Email address</Text>
            <TextInput
              value={settingsEmail}
              onChangeText={setSettingsEmail}
              placeholder="Email"
              placeholderTextColor={DesignColors.mediumGray}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: DesignColors.inputBg,
                borderWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                color: DesignColors.charcoal,
                marginBottom: 20,
              }}
            />
            <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 6 }}>
              Phone number <Text style={{ color: DesignColors.mediumGray }}>(optional)</Text>
            </Text>
            <Text style={{ fontSize: 12, color: DesignColors.mediumGray, marginBottom: 10 }}>
              Shared with workshop hosts you book with so they can reach you if needed.
            </Text>
            <TextInput
              value={settingsPhone}
              onChangeText={setSettingsPhone}
              placeholder="e.g. (416) 555-0123"
              placeholderTextColor={DesignColors.mediumGray}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              style={{
                backgroundColor: DesignColors.inputBg,
                borderWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                color: DesignColors.charcoal,
                marginBottom: 20,
              }}
            />
            <Text style={{ fontSize: 15, fontWeight: '600', color: DesignColors.charcoal, marginBottom: 8 }}>
              Workshop distance
            </Text>
            <Text style={{ fontSize: 12, color: DesignColors.mediumGray, marginBottom: 10 }}>
              We use this to sort workshops by proximity. You can update or clear it anytime.
            </Text>
            <TextInput
              value={settingsLocationPostal}
              onChangeText={setSettingsLocationPostal}
              placeholder="Postal code (A1A 1A1)"
              placeholderTextColor={DesignColors.mediumGray}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              style={{
                backgroundColor: DesignColors.inputBg,
                borderWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                color: DesignColors.charcoal,
                marginBottom: 10,
              }}
            />
            <Pressable
              onPress={async () => {
                if (!user?.id) return;
                const trimmed = settingsLocationPostal.trim();
                if (!trimmed) {
                  setSettingsError('Enter a postal code or use your location.');
                  return;
                }
                const norm = parseCanadianPostalCode(trimmed);
                if (!norm) {
                  setSettingsError('Use Canadian format, e.g. A1A 1A1.');
                  return;
                }
                setSettingsLocationAction('postal');
                setSettingsError(null);
                try {
                  const coords = await geocodeAddress(`${norm}, Canada`);
                  if (!coords) {
                    setSettingsError('Could not find that postal code.');
                    return;
                  }
                  const err = await upsertProfileLocation(user.id, {
                    postal_code: norm,
                    location_lat: coords.lat,
                    location_lng: coords.lng,
                  });
                  if (err) throw err;
                  setSettingsLocationPostal(norm);
                  refreshProfile();
                  emitProfileUpdated();
                } catch (e) {
                  setSettingsError(e instanceof Error ? e.message : 'Could not save location');
                } finally {
                  setSettingsLocationAction(null);
                }
              }}
              disabled={settingsLocationAction !== null}
              style={{
                paddingVertical: 12,
                borderRadius: 9999,
                backgroundColor: DesignColors.primary,
                alignItems: 'center',
                marginBottom: 10,
                opacity: settingsLocationAction !== null ? 0.7 : 1,
              }}
            >
              {settingsLocationAction === 'postal' ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFF' }}>Save postal code</Text>
              )}
            </Pressable>
            <Pressable
              onPress={async () => {
                if (!user?.id) return;
                setSettingsLocationAction('gps');
                setSettingsError(null);
                try {
                  const { status } = await Location.requestForegroundPermissionsAsync();
                  if (status !== 'granted') {
                    setSettingsError('Location permission was not granted.');
                    return;
                  }
                  const pos = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                  });
                  const lat = pos.coords.latitude;
                  const lng = pos.coords.longitude;
                  const postal = await reverseGeocodeCanadianPostal(lat, lng);
                  const err = await upsertProfileLocation(user.id, {
                    postal_code: postal,
                    location_lat: lat,
                    location_lng: lng,
                  });
                  if (err) throw err;
                  if (postal) setSettingsLocationPostal(postal);
                  refreshProfile();
                  emitProfileUpdated();
                } catch (e) {
                  setSettingsError(e instanceof Error ? e.message : 'Could not save location');
                } finally {
                  setSettingsLocationAction(null);
                }
              }}
              disabled={settingsLocationAction !== null}
              style={{
                paddingVertical: 12,
                borderRadius: 9999,
                backgroundColor: DesignColors.inputBg,
                borderWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
                alignItems: 'center',
                marginBottom: 10,
                opacity: settingsLocationAction !== null ? 0.7 : 1,
              }}
            >
              {settingsLocationAction === 'gps' ? (
                <ActivityIndicator size="small" color={DesignColors.sageGreen} />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '600', color: DesignColors.sageGreen }}>Use my location</Text>
              )}
            </Pressable>
            <Pressable
              onPress={async () => {
                if (!user?.id) return;
                setSettingsLocationAction('clear');
                setSettingsError(null);
                try {
                  const err = await upsertProfileLocation(user.id, {
                    postal_code: null,
                    location_lat: null,
                    location_lng: null,
                  });
                  if (err) throw err;
                  setSettingsLocationPostal('');
                  refreshProfile();
                  emitProfileUpdated();
                } catch (e) {
                  setSettingsError(e instanceof Error ? e.message : 'Could not clear location');
                } finally {
                  setSettingsLocationAction(null);
                }
              }}
              disabled={settingsLocationAction !== null}
              style={{ alignItems: 'center', paddingVertical: 10, marginBottom: 20 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.mediumGray }}>
                Clear saved location
              </Text>
            </Pressable>
            {settingsError ? (
              <Text style={{ color: '#B91C1C', fontSize: 14, marginBottom: 16 }}>{settingsError}</Text>
            ) : null}
            <Pressable
              onPress={async () => {
                if (!user?.id) return;
                setSettingsSaving(true);
                setSettingsError(null);
                try {
                  const nameTrim = settingsName.trim();
                  const emailTrim = settingsEmail.trim();
                  const postalRaw = settingsLocationPostal.trim();
                  const phoneNormalized = normalizeProfilePhone(settingsPhone);

                  let locationPatch: ProfileLocationUpsert | null = null;
                  if (postalRaw) {
                    const norm = parseCanadianPostalCode(postalRaw);
                    if (!norm) {
                      setSettingsError('Use Canadian postal format for workshop distance, e.g. A1A 1A1, or clear the field.');
                      setSettingsSaving(false);
                      return;
                    }
                    const coords = await geocodeAddress(`${norm}, Canada`);
                    if (!coords) {
                      setSettingsError('Could not find that postal code.');
                      setSettingsSaving(false);
                      return;
                    }
                    locationPatch = {
                      postal_code: norm,
                      location_lat: coords.lat,
                      location_lng: coords.lng,
                    };
                  }

                  const upsertBody: Record<string, string | number | null> = {
                    id: user.id,
                    display_name: nameTrim || null,
                    phone: phoneNormalized,
                    updated_at: new Date().toISOString(),
                  };
                  if (locationPatch) {
                    upsertBody.postal_code = locationPatch.postal_code;
                    upsertBody.location_lat = locationPatch.location_lat;
                    upsertBody.location_lng = locationPatch.location_lng;
                  }

                  const { error: profileUpsertError } = await supabase
                    .from('profiles')
                    .upsert(upsertBody, { onConflict: 'id' });
                  if (profileUpsertError) throw profileUpsertError;

                  if (locationPatch) {
                    setSettingsLocationPostal(locationPatch.postal_code ?? '');
                  }

                  if (emailTrim && emailTrim !== (user.email ?? '')) {
                    const { error: emailError } = await supabase.auth.updateUser({ email: emailTrim });
                    if (emailError) {
                      setSettingsError(emailError.message);
                      setSettingsSaving(false);
                      return;
                    }
                  }

                  refreshProfile();
                  emitProfileUpdated();
                  setSettingsVisible(false);
                } catch (e) {
                  setSettingsError(e instanceof Error ? e.message : 'Something went wrong');
                } finally {
                  setSettingsSaving(false);
                }
              }}
              disabled={settingsSaving}
              style={{
                paddingVertical: DesignSpacing.ctaPaddingVertical,
                borderRadius: 9999,
                backgroundColor: DesignColors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: settingsSaving ? 0.7 : 1,
              }}
            >
              {settingsSaving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFF' }}>Save</Text>
              )}
            </Pressable>
            {settingsEmail.trim() && settingsEmail.trim() !== (user?.email ?? '') ? (
              <Text style={{ fontSize: 12, color: DesignColors.mediumGray, marginTop: 12, textAlign: 'center' }}>
                Changing your email may require you to confirm the new address.
              </Text>
            ) : null}

            <View
              style={{
                marginTop: 28,
                paddingTop: 24,
                borderTopWidth: 1,
                borderTopColor: DesignColors.lightGreenBorder,
                alignItems: 'center',
              }}
            >
              <RNTouchableOpacity
                activeOpacity={0.85}
                onPress={() =>
                  Alert.alert(
                    'Delete account?',
                    'This permanently deletes your account and all associated data. This cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => void runDeleteAccount(),
                      },
                    ]
                  )
                }
                disabled={deletingAccount}
                style={{
                  minWidth: 180,
                  paddingVertical: 10,
                  paddingHorizontal: 18,
                  borderRadius: 9999,
                  borderWidth: 1,
                  borderColor: '#FECACA',
                  backgroundColor: '#FFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: deletingAccount ? 0.7 : 1,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#B91C1C' }}>Delete my account</Text>
              </RNTouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
