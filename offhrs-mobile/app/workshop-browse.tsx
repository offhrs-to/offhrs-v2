import CategoryFallbackImage from '@/components/CategoryFallbackImage';
import type { Event } from '@/components/EventCard';
import { EventCard } from '@/components/EventCard';
import { EventSaveHeartIcon } from '@/components/EventSaveHeartIcon';
import WorkshopsChrome from '@/components/WorkshopsChrome';
import { BOOK_API_BASE } from '@/constants/api';
import { CATEGORIES } from '@/constants/categories';
import { DesignColors, DesignSpacing } from '@/constants/design-template';
import { WORKSHOP_LIST_PAGE_SIZE } from '@/constants/workshops-list';
import { useAuth } from '@/contexts/AuthContext';
import { haversineKm } from '@/lib/distance';
import { supabase } from '@/lib/supabase';
import { buildDateStrip, eventMatchesCalendarDay, getTorontoYmd } from '@/lib/workshop-calendar';
import type { WorkshopEventRow } from '@/lib/workshops-events-query';
import { fetchWorkshopEvents } from '@/lib/workshops-events-query';
import * as Linking from 'expo-linking';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SaveButtonTouchable = Platform.OS === 'android' ? TouchableOpacity : GHTouchableOpacity;

const GRID_GAP = 12;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = (SCREEN_WIDTH - DesignSpacing.horizontalPadding * 2 - GRID_GAP) / 2;

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

function toCardEvent(r: WorkshopEventRow): Event {
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    location: r.location,
    image_url: r.image_url,
    price: r.price,
    external_link: r.external_link,
    vendor_id: r.vendor_id,
    category: r.category,
  };
}

export default function WorkshopBrowseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    q?: string;
    categories?: string;
  }>();

  const paramQ = parseParamString(params.q);
  const paramCat = parseParamString(params.categories);
  const initialCategory =
    paramCat && (CATEGORIES as readonly string[]).includes(paramCat) ? paramCat : null;

  const [searchTerm, setSearchTerm] = useState(paramQ);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory);

  const strip = useMemo(() => buildDateStrip(90), []);
  const [selectedYmd, setSelectedYmd] = useState(() => strip[0]?.ymd ?? getTorontoYmd());

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<WorkshopEventRow[]>([]);
  const [listPage, setListPage] = useState(1);

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

  useEffect(() => {
    const next =
      paramCat && (CATEGORIES as readonly string[]).includes(paramCat) ? paramCat : null;
    setSelectedCategory(next);
  }, [paramCat]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        setSavedEventIds(new Set());
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

  const categoriesForQuery = useMemo(
    () => (selectedCategory ? [selectedCategory] : [] as string[]),
    [selectedCategory]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchWorkshopEvents({
        searchTerm,
        categories: categoriesForQuery,
        dateRangeStart: null,
        dateRangeEnd: null,
      });
      setEvents(rows);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoriesForQuery]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    setListPage(1);
  }, [selectedYmd, selectedCategory, searchTerm]);

  const dayEvents = useMemo(
    () => events.filter((e) => eventMatchesCalendarDay(e, selectedYmd)),
    [events, selectedYmd]
  );

  const pagedEvents = useMemo(
    () => dayEvents.slice(0, listPage * WORKSHOP_LIST_PAGE_SIZE),
    [dayEvents, listPage]
  );

  const syncParams = (next: { q?: string; categories?: string | null }) => {
    router.setParams({
      q: next.q || undefined,
      categories: next.categories || undefined,
    });
  };

  const selectCategory = (cat: string | null) => {
    setSelectedCategory(cat);
    syncParams({
      q: searchTerm,
      categories: cat,
    });
  };

  const pushSearch = () => {
    const p = new URLSearchParams();
    if (searchTerm) p.set('q', searchTerm);
    if (selectedCategory) p.set('categories', selectedCategory);
    const qs = p.toString();
    router.push(qs ? `/workshop-search?${qs}` : '/workshop-search');
  };

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

  const pillCategories = useMemo(() => ['All', ...CATEGORIES] as const, []);

  return (
    <View style={{ flex: 1, backgroundColor: DesignColors.creamBg, paddingBottom: insets.bottom }}>
      <WorkshopsChrome
        showBack
        hideDateAndClear
        onBackPress={() => router.back()}
        searchAsButton
        searchPlaceholder="Search workshops…"
        searchValue={searchTerm}
        onSearchPress={pushSearch}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: DesignSpacing.horizontalPadding,
          paddingBottom: 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}>
            {pillCategories.map((label) => {
              const isAll = label === 'All';
              const active = isAll ? selectedCategory == null : selectedCategory === label;
              return (
                <Pressable
                  key={label}
                  onPress={() => selectCategory(isAll ? null : label)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 9999,
                    backgroundColor: active ? DesignColors.primary : DesignColors.inputBg,
                    borderWidth: 1,
                    borderColor: DesignColors.lightGreenBorder,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: active ? '#FFF' : DesignColors.charcoal,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}>
            {strip.map((d) => {
              const active = d.ymd === selectedYmd;
              return (
                <Pressable
                  key={d.ymd}
                  onPress={() => setSelectedYmd(d.ymd)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: active ? DesignColors.heroBg : DesignColors.inputBg,
                    borderWidth: 1,
                    borderColor: active ? DesignColors.primary : DesignColors.lightGreenBorder,
                    minWidth: 72,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: active ? DesignColors.primary : DesignColors.charcoal,
                      textAlign: 'center',
                    }}
                    numberOfLines={2}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={DesignColors.primary} />
          </View>
        ) : (
          <>
            <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 12 }}>
              {dayEvents.length} workshop{dayEvents.length === 1 ? '' : 's'} on this day
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
              {pagedEvents.map((row) => {
                const ev = toCardEvent(row);
                const dist =
                  profileLocation != null && row.lat != null && row.lng != null
                    ? Math.round(
                        haversineKm(
                          profileLocation.lat,
                          profileLocation.lng,
                          Number(row.lat),
                          Number(row.lng)
                        ) * 10
                      ) / 10
                    : undefined;
                return (
                  <View key={row.id} style={{ width: CARD_W }}>
                    <EventCard
                      event={ev}
                      distanceKm={dist}
                      saved={savedEventIds.has(row.id)}
                      onSaveChange={(id, saved) => {
                        setSavedEventIds((prev) => {
                          const next = new Set(prev);
                          if (saved) next.add(id);
                          else next.delete(id);
                          return next;
                        });
                      }}
                      onPress={() => setQuickViewEvent(rowToQv(row))}
                    />
                  </View>
                );
              })}
            </View>
            {dayEvents.length === 0 ? (
              <Text style={{ color: DesignColors.mediumGray, marginTop: 8 }}>Nothing scheduled for this day.</Text>
            ) : null}
            {pagedEvents.length < dayEvents.length ? (
              <Pressable
                onPress={() => setListPage((p) => p + 1)}
                style={{
                  marginTop: 20,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: DesignColors.lightGreenBorder,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.primary }}>Load more</Text>
              </Pressable>
            ) : null}
          </>
        )}
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
                    recyclingKey={`qv-browse-${quickViewEvent.id}`}
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
                    <SaveButtonTouchable
                      onPress={handleQuickViewSave}
                      disabled={quickViewSaving}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={quickViewSaved ? 'Remove from saved workshops' : 'Save workshop'}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        elevation: Platform.OS === 'android' ? 4 : undefined,
                      }}
                    >
                      {quickViewSaving ? (
                        <ActivityIndicator size="small" color={DesignColors.primary} />
                      ) : (
                        <EventSaveHeartIcon saved={quickViewSaved} size={26} />
                      )}
                    </SaveButtonTouchable>
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
