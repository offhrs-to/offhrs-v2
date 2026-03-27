import CategoryFallbackImage from '@/components/CategoryFallbackImage';
import type { Event } from '@/components/EventCard';
import { EventSaveHeartIcon } from '@/components/EventSaveHeartIcon';
import WorkshopsChrome from '@/components/WorkshopsChrome';
import WorkshopsMapPreview from '@/components/WorkshopsMapPreview';
import { BOOK_API_BASE } from '@/constants/api';
import { CATEGORIES as CATEGORY_LIST } from '@/constants/categories';
import {
  DesignColors,
  DesignSpacing,
} from '@/constants/design-template';
import { WORKSHOP_FETCH_LIMIT_HUB_PREVIEW } from '@/constants/workshops-list';
import { useAuth } from '@/contexts/AuthContext';
import { openWebAppPath } from '@/lib/web-app-links';
import { supabase } from '@/lib/supabase';
import { fetchWorkshopEvents } from '@/lib/workshops-events-query';
import { getCategoryMasterImageSource } from '@/lib/category-master-images';
import { haversineKm } from '@/lib/distance';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type EventWithCoords = Event & {
  lat?: number | null;
  lng?: number | null;
  date_iso?: string | null;
  recurrence?: string | null;
  category?: string | null;
};

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

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Toronto',
    });
  } catch {
    return isoString;
  }
}

function rowToEventWithCoords(row: {
  id: number;
  title: string | null;
  date: string | null;
  location: string | null;
  image_url: string | null;
  price: number | string | null;
  external_link: string | null;
  lat: number | null;
  lng: number | null;
  vendor_id: string | null;
  recurrence: string | null;
  category: string | null;
}): EventWithCoords {
  return {
    id: row.id,
    title: row.title ?? '',
    date: row.date ? formatDate(row.date) : '',
    date_iso: row.date ?? null,
    location: row.location ?? '',
    image_url: row.image_url ?? null,
    price: row.price ?? null,
    external_link: row.external_link ?? '',
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    vendor_id: row.vendor_id ?? null,
    recurrence: row.recurrence ?? null,
    category: row.category ?? null,
  };
}

export default function WorkshopsScreen() {
  const params = useLocalSearchParams<{
    q?: string;
    openEvent?: string;
    openTs?: string;
  }>();
  const qParam = typeof params.q === 'string' ? params.q : Array.isArray(params.q) ? params.q[0] : '';

  const [previewEvents, setPreviewEvents] = useState<EventWithCoords[]>([]);
  const [previewLoading, setPreviewLoading] = useState(true);

  const [quickViewEvent, setQuickViewEvent] = useState<EventWithCoords | null>(null);
  const [savedEventIds, setSavedEventIds] = useState<Set<number>>(new Set());
  const [quickViewSaving, setQuickViewSaving] = useState(false);

  const [profileLocation, setProfileLocation] = useState<{
    lat: number;
    lng: number;
    postal_code: string | null;
  } | null>(null);

  const router = useRouter();
  const { user } = useAuth();

  const distanceAnchorCoords = profileLocation;

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        setProfileLocation(null);
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
        .select('location_lat, location_lng, postal_code')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
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
        setPreviewEvents(
          rows.map((r) => ({
            id: r.id,
            title: r.title,
            date: r.date,
            date_iso: r.date_iso,
            location: r.location,
            image_url: r.image_url,
            price: r.price,
            external_link: r.external_link,
            lat: r.lat,
            lng: r.lng,
            vendor_id: r.vendor_id,
            recurrence: r.recurrence,
            category: r.category,
          }))
        );
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
    if (openEventId == null || openTs === '') return;
    const fromList = previewEvents.find((e) => Number(e.id) === openEventId);
    if (fromList) {
      setQuickViewEvent(fromList);
      return;
    }
    let cancelled = false;
    supabase
      .from('events')
      .select(
        'id, title, date, location, image_url, price, external_link, category, lat, lng, vendor_id, recurrence'
      )
      .eq('id', openEventId)
      .single()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setQuickViewEvent(rowToEventWithCoords(data));
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
          Browse nearby
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
            Listings may be incomplete or outdated. Confirm date, time, price, location, and requirements with the
            vendor before you rely on them. Offhrs does not process bookings or payments.
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 10,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => void openWebAppPath('/privacy')}
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
                Privacy Policy
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 12, color: DesignColors.mediumGray, marginHorizontal: 4 }}>·</Text>
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
                Terms of Service
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 12, color: DesignColors.mediumGray, marginHorizontal: 4 }}>·</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => void openWebAppPath('/disclaimer')}
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
                Listing disclaimer
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal visible={!!quickViewEvent} transparent animationType="fade" onRequestClose={() => setQuickViewEvent(null)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => setQuickViewEvent(null)}
          />
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: '#FFF',
              borderRadius: 20,
              overflow: 'hidden',
              paddingBottom: 20,
            }}
          >
            {quickViewEvent && (
              <>
                <View style={{ height: 200, width: '100%', backgroundColor: DesignColors.inputBg }}>
                  <CategoryFallbackImage
                    imageUrl={quickViewEvent.image_url}
                    category={quickViewEvent.category}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    recyclingKey={`qv-hub-${quickViewEvent.id}`}
                  />
                </View>
                {quickViewEvent.id != null && (
                  <View
                    pointerEvents="box-none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 200,
                      zIndex: 10,
                      elevation: Platform.OS === 'android' ? 10 : undefined,
                    }}
                  >
                    <Pressable
                      onPress={handleQuickViewSave}
                      disabled={quickViewSaving}
                      accessibilityRole="button"
                      accessibilityLabel={quickViewSaved ? 'Remove from saved workshops' : 'Save workshop'}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={({ pressed }) => ({
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: pressed ? 0.85 : 1,
                        elevation: Platform.OS === 'android' ? 4 : undefined,
                      })}
                    >
                      {quickViewSaving ? (
                        <ActivityIndicator size="small" color={DesignColors.primary} />
                      ) : (
                        <EventSaveHeartIcon saved={quickViewSaved} size={26} />
                      )}
                    </Pressable>
                  </View>
                )}
                <View style={{ padding: 16, paddingTop: 12 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal }} numberOfLines={2}>
                    {quickViewEvent.title}
                  </Text>
                  <Text style={{ marginTop: 8, fontSize: 14, color: DesignColors.mediumGray }}>{quickViewEvent.date}</Text>
                  {quickViewEvent.location ? (
                    <Text style={{ marginTop: 6, fontSize: 13, color: DesignColors.mediumGray }}>
                      {quickViewEvent.location}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 8,
                      flexWrap: 'wrap',
                      gap: 4,
                    }}
                  >
                    {quickViewEvent.price != null && String(quickViewEvent.price).trim() !== '' && (
                      <Text style={{ fontSize: 15, fontWeight: '600', color: DesignColors.charcoal }}>
                        {typeof quickViewEvent.price === 'string' && quickViewEvent.price.startsWith('$')
                          ? quickViewEvent.price
                          : `$${quickViewEvent.price}`}
                      </Text>
                    )}
                    {distanceAnchorCoords != null &&
                      quickViewEvent.lat != null &&
                      quickViewEvent.lng != null && (
                        <Text style={{ fontSize: 13, color: DesignColors.mediumGray }}>
                          {Math.round(
                            haversineKm(
                              distanceAnchorCoords.lat,
                              distanceAnchorCoords.lng,
                              Number(quickViewEvent.lat),
                              Number(quickViewEvent.lng)
                            ) * 10
                          ) / 10}{' '}
                          km away
                        </Text>
                      )}
                  </View>
                  <Text
                    style={{
                      marginTop: 12,
                      fontSize: 10,
                      color: DesignColors.mediumGray,
                      textAlign: 'center',
                      lineHeight: 14,
                    }}
                  >
                    You&apos;ll open the vendor&apos;s site. Their price, availability, and terms apply.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    {quickViewEvent.vendor_id && (
                      <Pressable
                        onPress={() => {
                          setQuickViewEvent(null);
                          router.push(`/vendors/${quickViewEvent.vendor_id}`);
                        }}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: DesignColors.primary,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.primary }}>Vendor</Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={async () => {
                        try {
                          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                          if (user?.id) {
                            const {
                              data: { session },
                            } = await supabase.auth.getSession();
                            if (session?.access_token) {
                              headers.Authorization = `Bearer ${session.access_token}`;
                            }
                          }
                          await fetch(`${BOOK_API_BASE}/api/book`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                              event_id: quickViewEvent.id,
                              event_title: quickViewEvent.title,
                            }),
                          });
                        } catch {}
                        const url = quickViewEvent.external_link?.trim();
                        if (url) Linking.openURL(url);
                        setQuickViewEvent(null);
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: DesignColors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFF' }}>Book</Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => setQuickViewEvent(null)}
                    style={{ marginTop: 12, paddingVertical: 8, alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 14, color: DesignColors.mediumGray }}>Close</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}
