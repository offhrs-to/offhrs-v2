import HomeCarouselSectionHeader from '@/components/HomeCarouselSectionHeader';
import MasteryProgressionSection from '@/components/MasteryProgressionSection';
import UpcomingTorontoCarousel from '@/components/UpcomingTorontoCarousel';
import WorkshopQuickViewModal from '@/components/WorkshopQuickViewModal';
import WorkshopsChrome from '@/components/WorkshopsChrome';
import WorkshopsMapPreview from '@/components/WorkshopsMapPreview';
import WorkshopsNearYouCarousel from '@/components/WorkshopsNearYouCarousel';
import type { HomeCarouselEventItem } from '@/components/HomeWorkshopCarouselCards';
import { DesignColors, DesignSpacing, isIOSPad } from '@/constants/design-template';
import { MASTERY_FEATURE_ENABLED } from '@/constants/feature-flags';
import { WORKSHOP_FETCH_LIMIT_HUB_PREVIEW } from '@/constants/workshops-list';
import { useAuth } from '@/contexts/AuthContext';
import { isEventVisibleToConsumers } from '@/lib/consumer-event-visibility';
import {
  patchSavedEventIds,
  subscribeEventSavesChanged,
  toggleUserEventSave,
} from '@/lib/event-saves';
import { PROFILE_UPDATED_EVENT } from '@/lib/profile-events';
import { supabase } from '@/lib/supabase';
import { enrichWorkshopEventsWithVendorNames } from '@/lib/workshop-vendor-display';
import {
  expandWorkshopEventsForConsumers,
  fetchWorkshopEvents,
  mapDbRowToWorkshopEvent,
  WORKSHOP_EVENT_LIST_SELECT,
  type WorkshopEventRow,
} from '@/lib/workshops-events-query';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { UserCircleIcon } from 'react-native-heroicons/outline';

const CREAM_BG = DesignColors.creamBg;
const CHARCOAL = '#2C2C2C';
const MEDIUM_GRAY = '#6B6B6B';

const HORIZONTAL_PADDING = DesignSpacing.horizontalPadding;

const isAndroid = Platform.OS === 'android';
const AVATAR_SIZE = isAndroid ? 40 : 44;
/** Scroll padding below content — room above floating tab bar. */
const SCROLL_PADDING_BOTTOM = isAndroid ? 76 : 28;
const SECTION_TITLE_FONT_SIZE = isAndroid ? 14 : 15;
const SECTION_SUBTITLE_FONT_SIZE = isAndroid ? 12 : 13;
const CAROUSEL_SECTION_GAP = isAndroid ? 10 : 12;

export default function HomeScreen() {
  const isIPad = isIOSPad();
  const homeScrollPaddingBottom = isIPad
    ? Math.max(SCROLL_PADDING_BOTTOM, 72)
    : SCROLL_PADDING_BOTTOM;

  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{
    q?: string;
    openEvent?: string;
    openTs?: string;
    t?: string;
  }>();
  const qParam =
    typeof params.q === 'string' ? params.q : Array.isArray(params.q) ? params.q[0] : '';

  const [profile, setProfile] = useState<{
    display_name: string | null;
    avatar_url: string | null;
    location_lat: number | null;
    location_lng: number | null;
    postal_code: string | null;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [homeRefreshNonce, setHomeRefreshNonce] = useState(0);
  const [torontoCarouselItems, setTorontoCarouselItems] = useState<HomeCarouselEventItem[]>([]);
  const [nearYouCarouselItems, setNearYouCarouselItems] = useState<HomeCarouselEventItem[]>([]);

  const [previewEvents, setPreviewEvents] = useState<WorkshopEventRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [quickViewEvent, setQuickViewEvent] = useState<WorkshopEventRow | null>(null);
  const [savedEventIds, setSavedEventIds] = useState<Set<number>>(new Set());
  const [quickViewSaving, setQuickViewSaving] = useState(false);

  const onTorontoItemsChange = useCallback((items: HomeCarouselEventItem[]) => {
    setTorontoCarouselItems(items);
  }, []);

  const onNearYouItemsChange = useCallback((items: HomeCarouselEventItem[]) => {
    setNearYouCarouselItems(items);
  }, []);

  const openCarouselBrowse = useCallback(
    (items: HomeCarouselEventItem[], heading: string, opts?: { sort?: 'time' | 'distance' }) => {
      if (items.length === 0) return;
      const p = new URLSearchParams();
      p.set('ids', items.map((it) => String(it.id)).join(','));
      p.set('heading', heading);
      if (opts?.sort) p.set('sort', opts.sort);
      router.push(`/workshop-browse?${p.toString()}`);
    },
    [router]
  );

  const refetchPreviewEvents = useCallback(() => {
    fetchWorkshopEvents({
      searchTerm: '',
      categories: [],
      dateRangeStart: null,
      dateRangeEnd: null,
      limit: WORKSHOP_FETCH_LIMIT_HUB_PREVIEW,
      light: true,
      skipMapCoords: false,
    })
      .then(setPreviewEvents)
      .catch(() => setPreviewEvents([]));
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setSavedEventIds(new Set());
      return;
    }
    const [{ data: profileData }, { data: saves }] = await Promise.all([
      supabase
        .from('profiles')
        .select('display_name, avatar_url, location_lat, location_lng, postal_code')
        .eq('id', user.id)
        .single(),
      supabase.from('user_event_saves').select('event_id').eq('user_id', user.id),
    ]);
    setProfile(profileData ?? null);
    setSavedEventIds(new Set((saves ?? []).map((r) => Number(r.event_id))));
  }, [user?.id]);

  const handleAndroidRefresh = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    setRefreshing(true);
    try {
      await refreshProfile();
      refetchPreviewEvents();
      setHomeRefreshNonce((n) => n + 1);
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile, refetchPreviewEvents]);

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(PROFILE_UPDATED_EVENT, () => {
      void refreshProfile();
    });
    return () => sub.remove();
  }, [refreshProfile]);

  useEffect(() => {
    return subscribeEventSavesChanged(({ eventId, saved }) => {
      setSavedEventIds((prev) => patchSavedEventIds(prev, eventId, saved));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPreviewLoading(true);
    fetchWorkshopEvents({
      searchTerm: '',
      categories: [],
      dateRangeStart: null,
      dateRangeEnd: null,
      limit: WORKSHOP_FETCH_LIMIT_HUB_PREVIEW,
      light: true,
      skipMapCoords: false,
    })
      .then((rows) => {
        if (!cancelled) setPreviewEvents(rows);
      })
      .catch(() => {
        if (!cancelled) setPreviewEvents([]);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [homeRefreshNonce]);

  const openEventId = useMemo(() => {
    const raw = params.openEvent;
    const oe = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
    if (!oe) return null;
    const id = Number(oe);
    return Number.isInteger(id) ? id : null;
  }, [params.openEvent]);

  const openTs = useMemo(() => {
    const rawTs = params.openTs;
    if (rawTs === undefined || rawTs === null) return '';
    return String(Array.isArray(rawTs) ? rawTs[0] : rawTs);
  }, [params.openTs]);

  const openRequestKey = useMemo(() => {
    const raw = params.t;
    return raw === undefined || raw === null ? '' : String(Array.isArray(raw) ? raw[0] : raw);
  }, [params.t]);

  useEffect(() => {
    if (openEventId == null) return;
    const looksLikeIsoTs = !!openTs && /\d{4}-\d{2}-\d{2}T/.test(openTs);
    const matchesTs = (rowDateIso: string | null | undefined): boolean => {
      if (!looksLikeIsoTs) return true;
      const ts = rowDateIso ?? '';
      return ts === openTs || ts.startsWith(openTs) || openTs.startsWith(ts);
    };

    const candidates = previewEvents.filter((e) => Number(e.id) === openEventId);
    if (candidates.length > 0) {
      const fromList = candidates.find((e) => matchesTs(e.date_iso)) ?? candidates[0];
      if (fromList) {
        setQuickViewEvent(fromList);
        return;
      }
    }

    let cancelled = false;
    supabase
      .from('events')
      .select(WORKSHOP_EVENT_LIST_SELECT)
      .eq('id', openEventId)
      .single()
      .then(async ({ data, error }) => {
        if (cancelled || error || !data) return;
        if (!isEventVisibleToConsumers(data)) return;
        const enriched = await enrichWorkshopEventsWithVendorNames(
          expandWorkshopEventsForConsumers([mapDbRowToWorkshopEvent(data)])
        );
        if (cancelled) return;
        if (!enriched || enriched.length === 0) {
          setQuickViewEvent(mapDbRowToWorkshopEvent(data));
          return;
        }
        const match = enriched.find((e) => matchesTs(e.date_iso)) ?? enriched[0];
        setQuickViewEvent(match ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [openEventId, openTs, openRequestKey, previewEvents]);

  const eventIdNum = quickViewEvent?.id != null ? Number(quickViewEvent.id) : null;
  const quickViewSaved = eventIdNum != null && savedEventIds.has(eventIdNum);

  const handleQuickViewSave = useCallback(async () => {
    const eid = quickViewEvent?.id != null ? Number(quickViewEvent.id) : null;
    if (eid == null || !Number.isInteger(eid) || quickViewSaving) return;
    if (!user?.id) {
      router.push('/login');
      return;
    }
    setQuickViewSaving(true);
    try {
      const isCurrentlySaved = savedEventIds.has(eid);
      const result = await toggleUserEventSave({
        userId: user.id,
        eventId: eid,
        currentlySaved: isCurrentlySaved,
      });
      if (!result.ok) {
        Alert.alert(isCurrentlySaved ? "Couldn't update" : "Couldn't save", result.message);
        return;
      }
      setSavedEventIds((prev) => patchSavedEventIds(prev, eid, result.saved));
    } finally {
      setQuickViewSaving(false);
    }
  }, [user?.id, quickViewEvent?.id, quickViewSaving, savedEventIds, router]);

  const pushSearch = () => {
    const p = new URLSearchParams();
    if (qParam) p.set('q', qParam);
    const qs = p.toString();
    router.push(qs ? `/workshop-search?${qs}` : '/workshop-search');
  };

  const pushMap = () => {
    const p = new URLSearchParams();
    if (qParam) p.set('q', qParam);
    const qs = p.toString();
    router.push(qs ? `/workshop-map?${qs}` : '/workshop-map');
  };

  const carouselLocationAnchor = useMemo(() => {
    if (profile?.location_lat == null || profile?.location_lng == null) return null;
    return { lat: Number(profile.location_lat), lng: Number(profile.location_lng) };
  }, [profile?.location_lat, profile?.location_lng]);

  const displayName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    String(user?.email ?? '').split('@')[0] ||
    'Guest';
  const avatarUrl =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null;

  const headerRight = authLoading ? null : !user ? (
    <Pressable
      onPress={() => router.push('/login')}
      accessibilityRole="button"
      accessibilityLabel="Sign up"
      style={{
        paddingHorizontal: 16,
        paddingVertical: isAndroid ? 8 : 9,
        borderRadius: 9999,
        backgroundColor: DesignColors.primary,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFF' }}>Sign-up</Text>
    </Pressable>
  ) : (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', minWidth: 0 }}>
      <View style={{ marginRight: 10, alignItems: 'flex-end', flexShrink: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>Welcome</Text>
        <Text
          style={{ fontSize: isAndroid ? 16 : 18, fontWeight: '700', color: CHARCOAL }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {displayName}
        </Text>
      </View>
      <View
        style={{
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: AVATAR_SIZE / 2,
          backgroundColor: avatarUrl ? 'transparent' : '#E0E0E0',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
            contentFit="cover"
          />
        ) : (
          <UserCircleIcon size={isAndroid ? 28 : 32} color={MEDIUM_GRAY} />
        )}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: CREAM_BG }}>
      <WorkshopsChrome
        searchAsButton
        hideDateAndClear
        searchPlaceholder="Search workshops…"
        searchValue={qParam}
        onSearchPress={pushSearch}
        headerRight={headerRight}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: HORIZONTAL_PADDING,
          paddingBottom: homeScrollPaddingBottom,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          Platform.OS === 'android' ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleAndroidRefresh}
              tintColor={DesignColors.primary}
              colors={[DesignColors.primary]}
              progressBackgroundColor={CREAM_BG}
            />
          ) : undefined
        }
      >
        <Text
          style={{
            fontSize: SECTION_TITLE_FONT_SIZE,
            fontWeight: '700',
            color: CHARCOAL,
            marginTop: 8,
            marginBottom: 8,
          }}
        >
          Tap the map to see all workshops
        </Text>
        <WorkshopsMapPreview
          events={previewEvents}
          loading={previewLoading}
          onPress={pushMap}
        />

        {MASTERY_FEATURE_ENABLED && user?.id ? (
          <View style={{ marginTop: CAROUSEL_SECTION_GAP }}>
            <MasteryProgressionSection userId={user.id} />
          </View>
        ) : null}

        <HomeCarouselSectionHeader
          title="Upcoming workshops in Toronto"
          titleStyle={{
            color: CHARCOAL,
            fontSize: SECTION_TITLE_FONT_SIZE,
            fontWeight: '700',
            textAlign: 'left',
          }}
          titleMarginTop={CAROUSEL_SECTION_GAP + 4}
          titleMarginBottom={6}
          onPressSeeAll={() =>
            openCarouselBrowse(torontoCarouselItems, 'Upcoming workshops in Toronto')
          }
          seeAllEnabled={torontoCarouselItems.length > 0}
        />
        <UpcomingTorontoCarousel
          userLocationAnchor={carouselLocationAnchor}
          refreshNonce={homeRefreshNonce}
          onItemsChange={onTorontoItemsChange}
        />

        <HomeCarouselSectionHeader
          title="Workshops near you"
          subtitle="Explore nearby classes"
          titleStyle={{
            color: CHARCOAL,
            fontSize: SECTION_TITLE_FONT_SIZE,
            fontWeight: '700',
            textAlign: 'left',
          }}
          subtitleStyle={{
            color: MEDIUM_GRAY,
            fontSize: SECTION_SUBTITLE_FONT_SIZE,
            fontWeight: '400',
            textAlign: 'left',
            alignSelf: 'stretch',
          }}
          titleMarginTop={CAROUSEL_SECTION_GAP}
          titleMarginBottom={6}
          onPressSeeAll={() =>
            openCarouselBrowse(nearYouCarouselItems, 'Workshops near you', { sort: 'distance' })
          }
          seeAllEnabled={nearYouCarouselItems.length > 0}
        />
        <WorkshopsNearYouCarousel
          userLocationAnchor={carouselLocationAnchor}
          showHintWhenNoLocation
          refreshNonce={homeRefreshNonce}
          onItemsChange={onNearYouItemsChange}
        />
      </ScrollView>

      <WorkshopQuickViewModal
        visible={!!quickViewEvent}
        event={quickViewEvent}
        onClose={() => setQuickViewEvent(null)}
        userId={user?.id}
        userEmail={user?.email ?? undefined}
        attendeeName={profile?.display_name?.trim() ?? ''}
        saved={quickViewSaved}
        saving={quickViewSaving}
        onToggleSave={handleQuickViewSave}
        profileLocation={
          profile?.location_lat != null && profile?.location_lng != null
            ? { lat: Number(profile.location_lat), lng: Number(profile.location_lng) }
            : null
        }
        profilePostalCode={profile?.postal_code ?? null}
        onBookingComplete={refetchPreviewEvents}
      />
    </View>
  );
}
