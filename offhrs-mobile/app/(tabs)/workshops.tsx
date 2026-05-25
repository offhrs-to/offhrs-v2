import WorkshopsChrome from '@/components/WorkshopsChrome';
import WorkshopsMapPreview from '@/components/WorkshopsMapPreview';
import WorkshopQuickViewModal from '@/components/WorkshopQuickViewModal';
import { CATEGORIES as CATEGORY_LIST } from '@/constants/categories';
import {
  DesignColors,
  DesignSpacing,
} from '@/constants/design-template';
import { WORKSHOP_FETCH_LIMIT_HUB_PREVIEW } from '@/constants/workshops-list';
import { useAuth } from '@/contexts/AuthContext';
import { openWebAppPath } from '@/lib/web-app-links';
import { supabase } from '@/lib/supabase';
import { isEventVisibleToConsumers } from '@/lib/consumer-event-visibility';
import {
  expandWorkshopEventsForConsumers,
  fetchWorkshopEvents,
  mapDbRowToWorkshopEvent,
  WORKSHOP_EVENT_LIST_SELECT,
  type WorkshopEventRow,
} from '@/lib/workshops-events-query';
import { enrichWorkshopEventsWithVendorNames } from '@/lib/workshop-vendor-display';
import { getCategoryMasterImageSource } from '@/lib/category-master-images';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

/** Tight gap so the 2×3 category grid fits above the tab bar on common phone heights. */
const CATEGORY_GRID_GAP = 10;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_WIDTH =
  (SCREEN_WIDTH - DesignSpacing.horizontalPadding * 2 - CATEGORY_GRID_GAP) / 2;
const TILE_HEIGHT = Math.round(TILE_WIDTH * 0.74);
/** Reserved strip for category title; image sits above so artwork is not cropped by the label. */
const CATEGORY_TILE_LABEL_H = 30;
const CATEGORY_TILE_UPPER_H = TILE_HEIGHT - CATEGORY_TILE_LABEL_H;
/** Same inner box for all 6 category tiles — larger art, still contained with `contain`. */
const CATEGORY_TILE_IMAGE_W = Math.round(TILE_WIDTH);
const CATEGORY_TILE_IMAGE_H = Math.round(CATEGORY_TILE_UPPER_H);
/** Slightly oversize layout vs the upper cell so masters read larger (centered; tile clips). */
const CATEGORY_TILE_IMAGE_LAYOUT_SCALE = 1.04;
/** Pottery artwork sits lighter in the frame than other category masters. */
const CATEGORY_TILE_POTTERY_IMAGE_SCALE = 1.14;

export default function WorkshopsScreen() {
  const params = useLocalSearchParams<{
    q?: string;
    openEvent?: string;
    openTs?: string;
  }>();
  const qParam = typeof params.q === 'string' ? params.q : Array.isArray(params.q) ? params.q[0] : '';

  const [previewEvents, setPreviewEvents] = useState<WorkshopEventRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(true);

  const [quickViewEvent, setQuickViewEvent] = useState<WorkshopEventRow | null>(null);
  const [savedEventIds, setSavedEventIds] = useState<Set<number>>(new Set());
  const [quickViewSaving, setQuickViewSaving] = useState(false);

  const [profileLocation, setProfileLocation] = useState<{
    lat: number;
    lng: number;
    postal_code: string | null;
  } | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);

  const router = useRouter();
  const { user } = useAuth();

  const refetchPreviewEvents = useCallback(() => {
    fetchWorkshopEvents({
      searchTerm: '',
      categories: [],
      dateRangeStart: null,
      dateRangeEnd: null,
      limit: WORKSHOP_FETCH_LIMIT_HUB_PREVIEW,
    })
      .then(setPreviewEvents)
      .catch(() => setPreviewEvents([]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        setProfileLocation(null);
        setProfileDisplayName(null);
        return;
      }
      supabase
        .from('user_event_saves')
        .select('event_id')
        .eq('user_id', user.id)
        .then(({ data }) => {
          setSavedEventIds(new Set((data ?? []).map((r) => Number(r.event_id))));
        });
      supabase
        .from('profiles')
        .select('location_lat, location_lng, postal_code, display_name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setProfileDisplayName(data?.display_name?.trim() || null);
          if (data?.location_lat != null && data?.location_lng != null) {
            setProfileLocation({
              lat: Number(data.location_lat),
              lng: Number(data.location_lng),
              postal_code: data.postal_code ?? null,
            });
          } else {
            setProfileLocation(null);
          }
        });
    }, [user?.id])
  );

  useEffect(() => {
    let cancelled = false;
    setPreviewLoading(true);
    fetchWorkshopEvents({
      searchTerm: '',
      categories: [],
      dateRangeStart: null,
      dateRangeEnd: null,
      limit: WORKSHOP_FETCH_LIMIT_HUB_PREVIEW,
    })
      .then((rows) => {
        if (cancelled) return;
        setPreviewEvents(rows);
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
  }, []);

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

  useEffect(() => {
    if (openEventId == null) return;
    // openTs is the event's ISO start (used to disambiguate which occurrence of a
    // multi-week series to open). It is optional - if it isn't an ISO timestamp
    // (e.g. an epoch ms passed from the home carousels), we fall back to the
    // first matching occurrence.
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
          // expand returned nothing (e.g. all occurrences already passed). Fall
          // back to the raw row so the modal still opens with the workshop info.
          const fallback = mapDbRowToWorkshopEvent(data);
          setQuickViewEvent(fallback);
          return;
        }
        const match = enriched.find((e) => matchesTs(e.date_iso)) ?? enriched[0];
        setQuickViewEvent(match ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [openEventId, openTs, previewEvents]);

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
      if (isCurrentlySaved) {
        const { error } = await supabase
          .from('user_event_saves')
          .delete()
          .eq('user_id', user.id)
          .eq('event_id', eid);
        if (error) {
          Alert.alert("Couldn't update", error.message ?? 'Please try again.');
        } else {
          setSavedEventIds((prev) => {
            const next = new Set(prev);
            next.delete(eid);
            return next;
          });
          const { data } = await supabase
            .from('user_event_saves')
            .select('event_id')
            .eq('user_id', user.id);
          if (data) setSavedEventIds(new Set(data.map((r) => Number(r.event_id))));
        }
      } else {
        const { error } = await supabase.from('user_event_saves').insert({ user_id: user.id, event_id: eid });
        if (error) {
          Alert.alert("Couldn't save", error.message ?? 'Please try again.');
        } else {
          setSavedEventIds((prev) => new Set(prev).add(eid));
          const { data } = await supabase
            .from('user_event_saves')
            .select('event_id')
            .eq('user_id', user.id);
          if (data) setSavedEventIds(new Set(data.map((r) => Number(r.event_id))));
        }
      }
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

  const pushBrowse = (category?: string) => {
    const p = new URLSearchParams();
    if (category) p.set('categories', category);
    if (qParam) p.set('q', qParam);
    router.push(`/workshop-browse?${p.toString()}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: DesignColors.creamBg }}>
      <WorkshopsChrome
        searchAsButton
        hideDateAndClear
        searchPlaceholder="Search workshops…"
        searchValue={qParam}
        onSearchPress={pushSearch}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: DesignSpacing.horizontalPadding,
          paddingBottom: Platform.OS === 'ios' ? 120 : 140,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: '700',
            color: DesignColors.charcoal,
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

        <Text
          style={{
            fontSize: 15,
            fontWeight: '700',
            color: DesignColors.charcoal,
            marginTop: 14,
            marginBottom: 8,
          }}
        >
          What sparks your curiosity?
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: CATEGORY_GRID_GAP,
            marginBottom: 12,
          }}
        >
          {CATEGORY_LIST.map((cat) => {
            const iconScale = cat === 'Pottery' ? CATEGORY_TILE_POTTERY_IMAGE_SCALE : 1;
            return (
            <Pressable
              key={cat}
              onPress={() => pushBrowse(cat)}
              style={{
                width: TILE_WIDTH,
                height: TILE_HEIGHT,
                borderRadius: 14,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
                backgroundColor: DesignColors.inputBg,
              }}
            >
              <View
                style={{
                  height: TILE_HEIGHT - CATEGORY_TILE_LABEL_H,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Image
                  source={getCategoryMasterImageSource(cat)}
                  style={{
                    width: Math.round(
                      CATEGORY_TILE_IMAGE_W * CATEGORY_TILE_IMAGE_LAYOUT_SCALE * iconScale
                    ),
                    height: Math.round(
                      CATEGORY_TILE_IMAGE_H * CATEGORY_TILE_IMAGE_LAYOUT_SCALE * iconScale
                    ),
                  }}
                  contentFit="contain"
                />
              </View>
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: CATEGORY_TILE_LABEL_H,
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.35)',
                }}
              >
                <Text
                  style={{ fontSize: 10, fontWeight: '700', color: '#FFF', lineHeight: 12 }}
                  numberOfLines={2}
                >
                  {cat}
                </Text>
              </View>
            </Pressable>
            );
          })}
        </View>

        <View
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: DesignColors.heroBg,
            borderWidth: 1,
            borderColor: DesignColors.lightGreenBorder,
            paddingVertical: 14,
            paddingHorizontal: 16,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: DesignColors.charcoal, lineHeight: 20 }}>
            Found a workshop you like? Tap the heart on a listing to save it to your profile.
          </Text>
        </View>

        <View
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            backgroundColor: 'rgba(251, 191, 36, 0.12)',
            borderWidth: 1,
            borderColor: 'rgba(251, 191, 36, 0.35)',
          }}
        >
          <Text style={{ fontSize: 11, color: DesignColors.charcoal, lineHeight: 16 }}>
            We do our best to keep listings useful, but hosts may update their workshops. Partner workshops you book in
            the app are paid securely through Stripe; always confirm details with the host. Other listings may send you
            to an external site to book.
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 10,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => void openWebAppPath('/terms')}
              style={{ paddingVertical: 8, paddingHorizontal: 6 }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: DesignColors.primary,
                  textDecorationLine: 'underline',
                }}
              >
                Terms &amp; policies
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <WorkshopQuickViewModal
        visible={!!quickViewEvent}
        event={quickViewEvent}
        onClose={() => setQuickViewEvent(null)}
        userId={user?.id}
        userEmail={user?.email ?? undefined}
        attendeeName={profileDisplayName ?? ''}
        saved={quickViewSaved}
        saving={quickViewSaving}
        onToggleSave={handleQuickViewSave}
        profileLocation={profileLocation ? { lat: profileLocation.lat, lng: profileLocation.lng } : null}
        profilePostalCode={profileLocation?.postal_code ?? null}
        onBookingComplete={refetchPreviewEvents}
      />

    </View>
  );
}
