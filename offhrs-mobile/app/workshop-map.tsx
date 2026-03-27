import { EventSaveHeartIcon } from '@/components/EventSaveHeartIcon';
import CategoryFallbackImage from '@/components/CategoryFallbackImage';
import WorkshopsChrome from '@/components/WorkshopsChrome';
import WorkshopMapView from '@/components/WorkshopMapView';
import { BOOK_API_BASE } from '@/constants/api';
import { DesignColors, DesignSpacing } from '@/constants/design-template';
import {
  WORKSHOP_FETCH_LIMIT_MAP_SCREEN,
  WORKSHOP_MAP_MARKER_CAP,
} from '@/constants/workshops-list';
import { useAuth } from '@/contexts/AuthContext';
import { haversineKm } from '@/lib/distance';
import { fetchVendorRatingMap, type VendorRatingSummary } from '@/lib/vendor-rating-map';
import { supabase } from '@/lib/supabase';
import type { WorkshopEventRow } from '@/lib/workshops-events-query';
import { fetchWorkshopEvents } from '@/lib/workshops-events-query';
import * as Linking from 'expo-linking';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LIST_THUMB = 56;

function parseParamString(v: string | string[] | undefined): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : v[0] ?? '';
}

type QvEvent = {
  id: number;
  title: string;
  date: string;
  date_iso: string | null;
  location: string;
  image_url: string | null;
  price: number | string | null;
  external_link: string;
  lat: number | null;
  lng: number | null;
  vendor_id: string | null;
  recurrence: string | null;
  category: string | null;
};

function rowToQv(r: WorkshopEventRow): QvEvent {
  return {
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
  };
}

function ratingLine(
  vendorId: string | null,
  ratingMap: Record<string, VendorRatingSummary>
): string {
  if (!vendorId) return 'Host ratings aren’t linked for this listing.';
  const s = ratingMap[vendorId];
  if (!s || s.count === 0) return 'No reviews yet — be the first to share feedback.';
  const label = s.count === 1 ? '1 review' : `${s.count} reviews`;
  const avg = Number.isInteger(s.avg) ? String(s.avg) : s.avg.toFixed(1);
  return `${avg} ★ average · ${label}`;
}

const MapEventListRow = memo(function MapEventListRow({
  item,
  vendorRatings,
  onOpen,
}: {
  item: WorkshopEventRow;
  vendorRatings: Record<string, VendorRatingSummary>;
  onOpen: (row: WorkshopEventRow) => void;
}) {
  const ratingText = ratingLine(item.vendor_id, vendorRatings);
  return (
    <Pressable
      onPress={() => onOpen(item)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: DesignColors.lightGreenBorder,
        gap: 12,
      }}
    >
      <View
        style={{
          width: LIST_THUMB,
          height: LIST_THUMB,
          borderRadius: LIST_THUMB / 2,
          overflow: 'hidden',
          backgroundColor: DesignColors.inputBg,
        }}
      >
        <CategoryFallbackImage
          imageUrl={item.image_url}
          category={item.category}
          style={{ width: LIST_THUMB, height: LIST_THUMB }}
          contentFit="cover"
          recyclingKey={`map-list-${item.id}`}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.charcoal }} numberOfLines={2}>
          {item.title}
        </Text>
        {item.date ? (
          <Text style={{ fontSize: 12, color: DesignColors.mediumGray, marginTop: 4 }} numberOfLines={1}>
            {item.date}
          </Text>
        ) : null}
        <Text style={{ fontSize: 11, color: DesignColors.mediumGray, marginTop: 4 }} numberOfLines={2}>
          {ratingText}
        </Text>
      </View>
    </Pressable>
  );
});

export default function WorkshopMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ q?: string }>();
  const paramQ = parseParamString(params.q);

  const [searchTerm, setSearchTerm] = useState(paramQ);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<WorkshopEventRow[]>([]);
  const [vendorRatings, setVendorRatings] = useState<Record<string, VendorRatingSummary>>({});

  const [quickViewEvent, setQuickViewEvent] = useState<QvEvent | null>(null);
  const [savedEventIds, setSavedEventIds] = useState<Set<number>>(new Set());
  const [quickViewSaving, setQuickViewSaving] = useState(false);

  const [profileLocation, setProfileLocation] = useState<{
    lat: number;
    lng: number;
    postal_code: string | null;
  } | null>(null);

  useEffect(() => {
    setSearchTerm(paramQ);
  }, [paramQ]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        setSavedEventIds(new Set());
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

  const containerH = useSharedValue(0);
  const listHeight = useSharedValue(280);
  const sheetDragStart = useSharedValue(0);
  const didLayoutInit = useRef(false);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-14, 14])
        .onStart(() => {
          sheetDragStart.value = listHeight.value;
        })
        .onUpdate((e) => {
          const H = containerH.value;
          if (H <= 0) return;
          const minH = Math.max(120, H * 0.15);
          const maxH = H * 0.93;
          listHeight.value = Math.min(maxH, Math.max(minH, sheetDragStart.value - e.translationY));
        })
        .onEnd((e) => {
          const H = containerH.value;
          if (H <= 0) return;
          const minH = Math.max(120, H * 0.15);
          const midH = H * 0.5;
          const maxH = H * 0.93;
          const v = listHeight.value;
          const vy = e.velocityY;
          let target: number;
          if (vy < -450) {
            target = v > midH + (maxH - midH) * 0.2 ? maxH : midH;
          } else if (vy > 450) {
            target = v < midH - (midH - minH) * 0.2 ? minH : midH;
          } else {
            const d0 = Math.abs(v - minH);
            const d1 = Math.abs(v - midH);
            const d2 = Math.abs(v - maxH);
            target = d0 <= d1 && d0 <= d2 ? minH : d1 <= d2 ? midH : maxH;
          }
          listHeight.value = withSpring(target, { damping: 34, stiffness: 380 });
        }),
    [containerH, listHeight, sheetDragStart]
  );

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    height: listHeight.value,
  }));

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchWorkshopEvents({
        searchTerm,
        categories: [],
        dateRangeStart: null,
        dateRangeEnd: null,
        limit: WORKSHOP_FETCH_LIMIT_MAP_SCREEN,
      });
      setEvents(rows);
      const vids = [...new Set(rows.map((r) => r.vendor_id).filter(Boolean))] as string[];
      const map = await fetchVendorRatingMap(vids);
      setVendorRatings(map);
    } catch {
      setEvents([]);
      setVendorRatings({});
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    reload();
  }, [reload]);

  const pushBrowse = () => {
    const p = new URLSearchParams();
    if (searchTerm) p.set('q', searchTerm);
    const qs = p.toString();
    router.push(qs ? `/workshop-browse?${qs}` : '/workshop-browse');
  };

  const openQuickView = useCallback((row: WorkshopEventRow) => {
    setQuickViewEvent(rowToQv(row));
  }, []);

  const handleMapEventPress = useCallback(
    (e: { id: number }) => {
      const row = events.find((x) => x.id === e.id);
      if (row) openQuickView(row);
    },
    [events, openQuickView]
  );

  const renderMapListItem = useCallback(
    ({ item }: { item: WorkshopEventRow }) => (
      <MapEventListRow item={item} vendorRatings={vendorRatings} onOpen={openQuickView} />
    ),
    [vendorRatings, openQuickView]
  );

  const keyExtractor = useCallback((item: WorkshopEventRow) => String(item.id), []);

  const listEmpty = useMemo(
    () => (
      <Text style={{ color: DesignColors.mediumGray, paddingVertical: 8 }}>No upcoming workshops.</Text>
    ),
    []
  );

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
        }
      } else {
        const { error } = await supabase.from('user_event_saves').insert({ user_id: user.id, event_id: eid });
        if (error) {
          Alert.alert("Couldn't save", error.message ?? 'Please try again.');
        } else {
          setSavedEventIds((prev) => new Set(prev).add(eid));
        }
      }
    } finally {
      setQuickViewSaving(false);
    }
  }, [user?.id, quickViewEvent?.id, quickViewSaving, savedEventIds, router]);

  return (
    <View style={{ flex: 1, backgroundColor: DesignColors.creamBg, paddingBottom: insets.bottom }}>
      <WorkshopsChrome
        showBack
        hideDateAndClear
        onBackPress={() => router.back()}
        searchAsButton
        searchPlaceholder="Search workshops…"
        searchValue={searchTerm}
        onSearchPress={() => {
          const p = new URLSearchParams();
          if (searchTerm) p.set('q', searchTerm);
          const qs = p.toString();
          router.push(qs ? `/workshop-search?${qs}` : '/workshop-search');
        }}
      />

      {Platform.OS === 'web' ? (
        <View style={{ flex: 1, minHeight: 0 }}>
          <View style={{ flex: 1, minHeight: 0 }}>
            <WorkshopMapView
              events={events}
              loading={loading}
              maxMarkers={WORKSHOP_MAP_MARKER_CAP}
              onEventPress={handleMapEventPress}
            />
          </View>
          <View
            style={{
              flex: 1,
              minHeight: 0,
              backgroundColor: '#FFF',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              borderTopWidth: 1,
              borderColor: DesignColors.lightGreenBorder,
              paddingHorizontal: DesignSpacing.horizontalPadding,
              paddingTop: 12,
            }}
          >
            <Pressable
              onPress={pushBrowse}
              style={{
                alignSelf: 'flex-start',
                marginBottom: 10,
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 9999,
                backgroundColor: DesignColors.primary,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>See full list</Text>
            </Pressable>
            {loading ? (
              <ActivityIndicator color={DesignColors.primary} style={{ marginTop: 8 }} />
            ) : (
              <FlatList
                style={{ flex: 1 }}
                data={events}
                keyExtractor={keyExtractor}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={12}
                maxToRenderPerBatch={12}
                windowSize={7}
                renderItem={renderMapListItem}
                ListEmptyComponent={listEmpty}
              />
            )}
          </View>
        </View>
      ) : (
        <View
          style={{ flex: 1, minHeight: 0 }}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            containerH.value = h;
            if (!didLayoutInit.current && h > 0) {
              listHeight.value = h * 0.5;
              didLayoutInit.current = true;
            }
          }}
        >
          <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            <WorkshopMapView
              events={events}
              loading={loading}
              maxMarkers={WORKSHOP_MAP_MARKER_CAP}
              onEventPress={handleMapEventPress}
            />
          </View>
          <Animated.View
            style={[
              sheetAnimatedStyle,
              {
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#FFF',
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                borderTopWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
                overflow: 'hidden',
              },
            ]}
          >
            <View style={{ paddingHorizontal: DesignSpacing.horizontalPadding }}>
              <GestureDetector gesture={panGesture}>
                <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
                  <View
                    style={{
                      width: 40,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: DesignColors.placeholderGray,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 10,
                      color: DesignColors.mediumGray,
                      marginTop: 6,
                    }}
                  >
                    Drag to resize map or list
                  </Text>
                </View>
              </GestureDetector>
              <Pressable
                onPress={pushBrowse}
                style={{
                  alignSelf: 'flex-start',
                  marginBottom: 10,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 9999,
                  backgroundColor: DesignColors.primary,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>See full list</Text>
              </Pressable>
            </View>
            <View style={{ flex: 1, minHeight: 0, paddingHorizontal: DesignSpacing.horizontalPadding }}>
              {loading ? (
                <ActivityIndicator color={DesignColors.primary} style={{ marginTop: 8 }} />
              ) : (
                <FlatList
                  style={{ flex: 1 }}
                  data={events}
                  keyExtractor={keyExtractor}
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={12}
                  maxToRenderPerBatch={12}
                  windowSize={7}
                  removeClippedSubviews={Platform.OS === 'android'}
                  renderItem={renderMapListItem}
                  ListEmptyComponent={listEmpty}
                />
              )}
            </View>
          </Animated.View>
        </View>
      )}

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
                    recyclingKey={`qv-map-${quickViewEvent.id}`}
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
                    {profileLocation != null &&
                      quickViewEvent.lat != null &&
                      quickViewEvent.lng != null && (
                        <Text style={{ fontSize: 13, color: DesignColors.mediumGray }}>
                          {Math.round(
                            haversineKm(
                              profileLocation.lat,
                              profileLocation.lng,
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
