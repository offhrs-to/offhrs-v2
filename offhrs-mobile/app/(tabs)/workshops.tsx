import { EventCard, CARD_TOTAL_HEIGHT, CARD_TOTAL_HEIGHT_ANDROID, type Event } from '@/components/EventCard';
import WorkshopMapView from '@/components/WorkshopMapView';
import { geocodeAddress } from '@/lib/geocode';
import { haversineKm } from '@/lib/distance';
import { BOOK_API_BASE } from '@/constants/api';
import {
  DesignColors,
  DesignSpacing,
  DesignSizes,
} from '@/constants/design-template';
import { CATEGORIES as CATEGORY_LIST } from '@/constants/categories';
import { WORKSHOP_LIST_PAGE_SIZE, WORKSHOP_MAX_UPCOMING_FETCH } from '@/constants/workshops-list';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

/** On Android, Modal renders in a separate window; gesture-handler touchables often don't receive touches. Use RN TouchableOpacity there. */
const SaveButtonTouchable = Platform.OS === 'android' ? TouchableOpacity : GHTouchableOpacity;
import DateTimePicker from '@react-native-community/datetimepicker';

type EventWithCoords = Event & {
  lat?: number | null;
  lng?: number | null;
  date_iso?: string | null;
};

const CATEGORIES = ['All', ...CATEGORY_LIST];

const GRID_GAP = 12;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - DesignSpacing.horizontalPadding * 2 - GRID_GAP) / 2;

const WEB_APP_ORIGIN =
  (process.env.EXPO_PUBLIC_APP_URL || '').replace(/\/$/, '') || BOOK_API_BASE;

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

const softShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
};

export default function WorkshopsScreen() {
  const params = useLocalSearchParams<{
    q?: string;
    categories?: string;
    address?: string;
    openEvent?: string;
    openTs?: string;
  }>();
  const initialQ = params.q ?? '';
  const initialCategories = String(params.categories ?? '').split(',').filter(Boolean);
  const addressParam = typeof params.address === 'string' ? decodeURIComponent(params.address) : '';

  const [searchTerm, setSearchTerm] = useState(initialQ);
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [addressGeocoding, setAddressGeocoding] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(
    initialCategories.length === 1 ? initialCategories[0]! : 'All'
  );
  const [userChangedCategory, setUserChangedCategory] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [events, setEvents] = useState<EventWithCoords[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quickViewEvent, setQuickViewEvent] = useState<EventWithCoords | null>(null);
  const [savedEventIds, setSavedEventIds] = useState<Set<number>>(new Set());
  const [quickViewSaving, setQuickViewSaving] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState<string | null>(null);
  const [dateRangeEnd, setDateRangeEnd] = useState<string | null>(null);
  const [dateInputStart, setDateInputStart] = useState('');
  const [dateInputEnd, setDateInputEnd] = useState('');
  const [activeDateField, setActiveDateField] = useState<'from' | 'to' | null>(null);
  const [pickerDate, setPickerDate] = useState(() => new Date());
  const [listPage, setListPage] = useState(1);
  const listScrollRef = useRef<ScrollView>(null);

  const router = useRouter();
  const { user } = useAuth();

  /** Home carousel (and deep links): open quick view when `openTs` changes so repeat taps work. */
  useEffect(() => {
    if (loading) return;
    const rawId = params.openEvent;
    const rawTs = params.openTs;
    const oe = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
    const ts =
      rawTs !== undefined && rawTs !== null
        ? String(Array.isArray(rawTs) ? rawTs[0] : rawTs)
        : undefined;
    if (!oe || ts === undefined || ts === '') return;
    const id = Number(oe);
    if (!Number.isInteger(id)) return;
    const ev = events.find((e) => Number(e.id) === id);
    if (ev) setQuickViewEvent(ev);
  }, [params.openEvent, params.openTs, loading, events]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      supabase
        .from('user_event_saves')
        .select('event_id')
        .eq('user_id', user.id)
        .then(({ data }) => {
          setSavedEventIds(new Set((data ?? []).map((r) => Number(r.event_id))));
        });
    }, [user?.id])
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
          console.warn('user_event_saves delete error', error);
        } else {
          setSavedEventIds((prev) => {
            const next = new Set(prev);
            next.delete(eid);
            return next;
          });
          // Refetch from DB to keep workshops and Profile in sync
          const { data } = await supabase
            .from('user_event_saves')
            .select('event_id')
            .eq('user_id', user.id);
          if (data) setSavedEventIds(new Set(data.map((r) => Number(r.event_id))));
        }
      } else {
        const { error } = await supabase
          .from('user_event_saves')
          .insert({ user_id: user.id, event_id: eid });
        if (error) {
          console.warn('user_event_saves insert error', error);
        } else {
          setSavedEventIds((prev) => new Set(prev).add(eid));
          // Refetch from DB to keep workshops and Profile in sync
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
  }, [user?.id, quickViewEvent?.id, quickViewSaving, savedEventIds]);

  const effectiveCategories =
    !userChangedCategory && initialCategories.length > 0
      ? initialCategories
      : selectedCategory === 'All'
        ? []
        : [selectedCategory];

  const categoriesParam = params.categories ?? '';

  const fetchEvents = useCallback(async () => {
    const initialCats = String(params.categories ?? '').split(',').filter(Boolean);
    const effective =
      !userChangedCategory && initialCats.length > 0
        ? initialCats
        : selectedCategory === 'All'
          ? []
          : [selectedCategory];

    try {
      setLoading(true);
      let searchRawWords: string[] = [];
      let searchVendorIds: string[] = [];

      let query = supabase
        .from('events')
        .select('id, title, date, location, image_url, price, external_link, category, lat, lng, vendor_id, recurrence');

      const nowIso = new Date().toISOString();
      query = query.or(
        `recurrence.eq.daily,recurrence.eq.weekly,date.is.null,date.gte.${nowIso}`
      );

      if (searchTerm.trim()) {
        const term = searchTerm.trim();
        searchRawWords = term.split(/\s+/).filter(Boolean);
        const escapedWords = searchRawWords.map((w) => w.replace(/%/g, '\\%'));
        // Vendors whose name contains ALL words (any order)
        if (escapedWords.length > 0) {
          const idSets: Set<string>[] = [];
          for (const word of escapedWords) {
            const { data: rows } = await supabase
              .from('vendors')
              .select('id')
              .ilike('name', `%${word}%`);
            idSets.push(new Set((rows ?? []).map((v) => v.id).filter(Boolean)));
          }
          let intersect = new Set(idSets[0]);
          for (let i = 1; i < idSets.length; i++) {
            intersect = new Set([...intersect].filter((id) => idSets[i].has(id)));
          }
          searchVendorIds = [...intersect];
        }
        const orParts = escapedWords.flatMap(
          (w) => [`title.ilike.%${w}%`, `category.ilike.%${w}%`]
        );
        if (searchVendorIds.length > 0) orParts.push(`vendor_id.in.(${searchVendorIds.join(',')})`);
        const orClause = orParts.length > 0 ? orParts.join(',') : 'id.eq.-1';
        query = query.or(orClause);
      }
      if (effective.length > 0) {
        query = query.in('category', effective);
      }

      query = query
        .order('date', { ascending: true })
        .limit(WORKSHOP_MAX_UPCOMING_FETCH);

      const { data, error } = await query;
      if (error) throw error;

      const list = (data ?? [])
        .map((row) => ({
          id: row.id,
          title: row.title ?? '',
          date: formatDate(row.date ?? ''),
          date_iso: row.date ?? null,
          location: row.location ?? '',
          image_url: row.image_url ?? null,
          price: row.price ?? null,
          external_link: row.external_link ?? '',
          lat: row.lat ?? null,
          lng: row.lng ?? null,
          vendor_id: row.vendor_id ?? null,
          recurrence: row.recurrence ?? null,
        }))
        .filter((e) => {
          if (!e.date_iso) return !dateRangeStart && !dateRangeEnd;
          const eventDate = e.date_iso.slice(0, 10);
          if (dateRangeStart && eventDate < dateRangeStart) return false;
          if (dateRangeEnd && eventDate > dateRangeEnd) return false;
          return true;
        })
        .sort((a, b) => {
          const aTime = a.date_iso ? new Date(a.date_iso).getTime() : Infinity;
          const bTime = b.date_iso ? new Date(b.date_iso).getTime() : Infinity;
          return aTime - bTime;
        });
      // When searching: keep only events where vendor matches OR title/category contains every word
      const filtered =
        searchRawWords.length > 0 || searchVendorIds.length > 0
          ? list.filter((e) => {
              if (searchVendorIds.length > 0 && e.vendor_id && searchVendorIds.includes(e.vendor_id))
                return true;
              if (searchRawWords.length === 0) return true;
              return searchRawWords.every(
                (w) =>
                  (e.title && e.title.toLowerCase().includes(w.toLowerCase())) ||
                  (e.category && e.category.toLowerCase().includes(w.toLowerCase()))
              );
            })
          : list;
      setEvents(filtered);
    } catch (e) {
      console.error('Error fetching events:', e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, userChangedCategory, selectedCategory, categoriesParam, dateRangeStart, dateRangeEnd]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    setListPage(1);
  }, [searchTerm, userChangedCategory, selectedCategory, categoriesParam, dateRangeStart, dateRangeEnd]);

  const listTotalPages = Math.max(1, Math.ceil(events.length / WORKSHOP_LIST_PAGE_SIZE));
  const safeListPage = Math.min(listPage, listTotalPages);
  const listPageStart = (safeListPage - 1) * WORKSHOP_LIST_PAGE_SIZE;
  const paginatedEvents = useMemo(
    () => events.slice(listPageStart, listPageStart + WORKSHOP_LIST_PAGE_SIZE),
    [events, listPageStart]
  );

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(events.length / WORKSHOP_LIST_PAGE_SIZE));
    setListPage((p) => Math.min(p, tp));
  }, [events.length]);

  useEffect(() => {
    if (!addressParam.trim()) {
      setAddressCoords(null);
      return;
    }
    let cancelled = false;
    setAddressGeocoding(true);
    geocodeAddress(addressParam)
      .then((coords) => {
        if (!cancelled && coords) setAddressCoords(coords);
        else if (!cancelled) setAddressCoords(null);
      })
      .catch(() => {
        if (!cancelled) setAddressCoords(null);
      })
      .finally(() => {
        if (!cancelled) setAddressGeocoding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addressParam]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchEvents();
    } finally {
      setRefreshing(false);
    }
  }, [fetchEvents]);

  return (
    <View style={{ flex: 1, backgroundColor: DesignColors.creamBg }}>
      {/* Header: logo only (map toggle is the floating button) */}
      <View
        style={{
          paddingTop: DesignSpacing.contentPaddingTop,
          paddingBottom: DesignSpacing.logoHeaderPaddingBottom,
          paddingHorizontal: DesignSpacing.horizontalPadding,
          backgroundColor: DesignColors.creamBg,
        }}
      >
        <View style={{ marginLeft: DesignSpacing.logoMarginLeft, paddingLeft: 0 }}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={{ height: DesignSizes.logoHeight, width: DesignSizes.logoWidth }}
            contentFit="contain"
          />
        </View>
      </View>

      {/* Search + filter bar – tight vertical spacing */}
      <View style={{ flexShrink: 0 }}>
        <View
          style={{
            paddingHorizontal: DesignSpacing.horizontalPadding,
            paddingTop: 0,
            paddingBottom: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <TextInput
            placeholder="Search..."
            placeholderTextColor={DesignColors.mediumGray}
            value={searchTerm}
            onChangeText={setSearchTerm}
            style={{
              flex: 1,
              backgroundColor: DesignColors.inputBg,
              borderRadius: 9999,
              borderWidth: 1,
              borderColor: DesignColors.lightGreenBorder,
              paddingHorizontal: 14,
              paddingVertical: 8,
              height: 36,
              fontSize: 13,
              color: DesignColors.charcoal,
            }}
          />
          <Pressable
            onPress={() => {
              setDateInputStart(dateRangeStart ?? '');
              setDateInputEnd(dateRangeEnd ?? '');
              setDatePickerVisible(true);
            }}
            style={{
              height: 36,
              paddingHorizontal: 12,
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: 9999,
              backgroundColor: (dateRangeStart ?? dateRangeEnd) ? DesignColors.primary : DesignColors.creamBg,
              borderWidth: 1,
              borderColor: DesignColors.lightGreenBorder,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: (dateRangeStart ?? dateRangeEnd) ? '#FFF' : DesignColors.sageGreen,
              }}
            >
              Date
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setSearchTerm('');
              setUserChangedCategory(true);
              setSelectedCategory('All');
              setDateRangeStart(null);
              setDateRangeEnd(null);
            }}
            style={{
              height: 36,
              paddingHorizontal: 12,
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: 9999,
              backgroundColor: DesignColors.creamBg,
              borderWidth: 1,
              borderColor: DesignColors.lightGreenBorder,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: DesignColors.sageGreen,
              }}
            >
              Clear
            </Text>
          </Pressable>
        </View>

        {/* Filter bar – pills same height as search bar, no extra space below */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: GRID_GAP,
            paddingHorizontal: DesignSpacing.horizontalPadding,
            paddingVertical: 0,
            paddingBottom: 0,
            alignItems: 'center',
          }}
          style={{ marginRight: 0, height: 36, flexGrow: 0 }}
        >
        {CATEGORIES.map((cat) => {
          const isActive =
            cat === 'All'
              ? effectiveCategories.length === 0
              : effectiveCategories.includes(cat);
          return (
            <Pressable
              key={cat}
              onPress={() => {
                setUserChangedCategory(true);
                setSelectedCategory(cat);
              }}
              style={{
                height: 36,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 9999,
                backgroundColor: isActive ? DesignColors.primary : DesignColors.creamBg,
                borderWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: isActive ? '#FFF' : DesignColors.sageGreen,
                }}
              >
                {cat}
              </Text>
            </Pressable>
          );
        })}
        </ScrollView>
      </View>

      {viewMode === 'list' ? (
        <ScrollView
          ref={listScrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: DesignSpacing.horizontalPadding,
            paddingTop: 12,
            paddingBottom: Platform.OS === 'ios' ? 120 : 140,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {addressParam.trim() && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: DesignColors.mediumGray }} numberOfLines={1}>
                {addressGeocoding ? 'Resolving address…' : addressCoords ? `Distance from: ${addressParam}` : `Could not find address: ${addressParam}`}
              </Text>
            </View>
          )}
          {loading && events.length === 0 ? (
            <Text
              style={{
                paddingVertical: 32,
                textAlign: 'center',
                color: DesignColors.mediumGray,
              }}
            >
              Loading...
            </Text>
          ) : events.length === 0 ? (
            <Text
              style={{
                paddingVertical: 32,
                textAlign: 'center',
                color: DesignColors.mediumGray,
              }}
            >
              No workshops found. Pull to refresh.
            </Text>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: GRID_GAP,
              }}
            >
              {paginatedEvents.map((event) => {
                const distanceKm =
                  addressCoords != null &&
                  event.lat != null &&
                  event.lng != null
                    ? haversineKm(
                        addressCoords.lat,
                        addressCoords.lng,
                        Number(event.lat),
                        Number(event.lng)
                      )
                    : null;
                return (
                  <View key={event.id} style={{ width: CARD_WIDTH, height: Platform.OS === 'android' ? CARD_TOTAL_HEIGHT_ANDROID : CARD_TOTAL_HEIGHT }}>
                    <EventCard
                      event={event}
                      distanceKm={distanceKm != null ? Math.round(distanceKm * 10) / 10 : undefined}
                      onPress={() => setQuickViewEvent(event)}
                      saved={savedEventIds.has(Number(event.id))}
                      onSaveChange={(eventId, saved) => {
                        setSavedEventIds((prev) => {
                          const next = new Set(prev);
                          if (saved) next.add(eventId);
                          else next.delete(eventId);
                          return next;
                        });
                      }}
                    />
                  </View>
                );
              })}
            </View>
          )}
          {events.length > 0 && viewMode === 'list' ? (
            <View style={{ marginTop: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: DesignColors.mediumGray, textAlign: 'center', marginBottom: 8 }}>
                Showing {events.length === 0 ? 0 : listPageStart + 1}–
                {Math.min(listPageStart + WORKSHOP_LIST_PAGE_SIZE, events.length)} of {events.length}
              </Text>
              {listTotalPages > 1 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      setListPage((p) => Math.max(1, p - 1));
                      listScrollRef.current?.scrollTo({ y: 0, animated: true });
                    }}
                    disabled={safeListPage <= 1}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 9999,
                      borderWidth: 1,
                      borderColor: DesignColors.lightGreenBorder,
                      opacity: safeListPage <= 1 ? 0.45 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: DesignColors.primary }}>Previous</Text>
                  </Pressable>
                  <Text style={{ fontSize: 13, color: DesignColors.charcoal }}>
                    Page {safeListPage} of {listTotalPages}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setListPage((p) => Math.min(listTotalPages, p + 1));
                      listScrollRef.current?.scrollTo({ y: 0, animated: true });
                    }}
                    disabled={safeListPage >= listTotalPages}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 9999,
                      borderWidth: 1,
                      borderColor: DesignColors.lightGreenBorder,
                      opacity: safeListPage >= listTotalPages ? 0.45 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: DesignColors.primary }}>Next</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}
          <View
            style={{
              marginTop: 20,
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
                gap: 8,
                marginTop: 10,
              }}
            >
              <Pressable onPress={() => Linking.openURL(`${WEB_APP_ORIGIN}/disclaimer`)}>
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
              </Pressable>
              <Text style={{ fontSize: 12, color: DesignColors.mediumGray }}>·</Text>
              <Pressable onPress={() => Linking.openURL(`${WEB_APP_ORIGIN}/terms`)}>
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
              </Pressable>
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={{ flex: 1, minHeight: 400, marginTop: 12 }}>
          <WorkshopMapView
            events={events}
            loading={loading}
            onEventPress={(e) => setQuickViewEvent(e)}
          />
        </View>
      )}

      {Platform.OS !== 'web' && (
        <Pressable
          onPress={() => setViewMode((m) => (m === 'list' ? 'map' : 'list'))}
          style={{
            position: 'absolute',
            bottom: Platform.OS === 'ios' ? 84 : 92,
            right: DesignSpacing.horizontalPadding,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: DesignColors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            ...softShadow,
          }}
        >
          <Text style={{ fontSize: 20 }}>{viewMode === 'list' ? '🗺' : '📋'}</Text>
        </Pressable>
      )}

      {/* Quick view modal */}
      <Modal
        visible={!!quickViewEvent}
        transparent
        animationType="fade"
        onRequestClose={() => setQuickViewEvent(null)}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          {/* Overlay – tap outside to dismiss */}
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => setQuickViewEvent(null)}
          />
          {/* Card – View only; no responder so Save/Vendor/Book get touches. Overlay is behind so only backdrop taps close. */}
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
                {/* Image area – no Save here so overlay can receive touches */}
                <View style={{ height: 200, width: '100%', backgroundColor: DesignColors.inputBg }}>
                  {quickViewEvent.image_url ? (
                    <Image
                      source={{ uri: quickViewEvent.image_url }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: DesignColors.mediumGray }}>No image</Text>
                    </View>
                  )}
                </View>
                {/* Dedicated overlay for Save. On Android use RN TouchableOpacity (reliable inside Modal); on iOS use gesture-handler. */}
                {quickViewEvent.id != null && (
                  <View
                    pointerEvents="box-none"
                    collapsable={Platform.OS !== 'android'}
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
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        borderRadius: 20,
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        elevation: Platform.OS === 'android' ? 4 : undefined,
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: quickViewSaved ? DesignColors.primary : DesignColors.charcoal }}>
                        {quickViewSaved ? 'Saved ✓' : 'Save'}
                      </Text>
                    </SaveButtonTouchable>
                  </View>
                )}
                <View style={{ padding: 16, paddingTop: 12 }}>
                  <Text
                    style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal }}
                    numberOfLines={2}
                  >
                    {quickViewEvent.title}
                  </Text>
                  <Text style={{ marginTop: 8, fontSize: 14, color: DesignColors.mediumGray }}>
                    {quickViewEvent.date}
                  </Text>
                  {quickViewEvent.location ? (
                    <Text style={{ marginTop: 6, fontSize: 13, color: DesignColors.mediumGray }}>
                      {quickViewEvent.location}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 4 }}>
                    {quickViewEvent.price != null && String(quickViewEvent.price).trim() !== '' && (
                      <Text style={{ fontSize: 15, fontWeight: '600', color: DesignColors.charcoal }}>
                        {typeof quickViewEvent.price === 'string' && quickViewEvent.price.startsWith('$')
                          ? quickViewEvent.price
                          : `$${quickViewEvent.price}`}
                      </Text>
                    )}
                    {addressCoords != null &&
                      quickViewEvent.lat != null &&
                      quickViewEvent.lng != null && (
                        <Text style={{ fontSize: 13, color: DesignColors.mediumGray }}>
                          {Math.round(haversineKm(addressCoords.lat, addressCoords.lng, Number(quickViewEvent.lat), Number(quickViewEvent.lng)) * 10) / 10} km away
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
                        <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.primary }}>
                          Vendor
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={async () => {
                        try {
                          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                          if (user?.id) {
                            const { data: { session } } = await supabase.auth.getSession();
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
                    style={{
                      marginTop: 12,
                      paddingVertical: 8,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14, color: DesignColors.mediumGray }}>Close</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Date range filter modal */}
      <Modal
        visible={datePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onPress={() => setDatePickerVisible(false)}
        >
          <Pressable
            style={{
              width: '100%',
              maxWidth: 340,
              backgroundColor: '#FFF',
              borderRadius: 20,
              padding: 24,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal, marginBottom: 16 }}>
              Filter by date range
            </Text>
            <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 6 }}>From</Text>
            {Platform.OS === 'web' ? (
              <View style={{ marginBottom: 16 }}>
                {createElement('input', {
                  type: 'date',
                  value: dateInputStart,
                  onChange: (e: { target: { value: string } }) => setDateInputStart(e.target.value || ''),
                  style: {
                    width: '100%',
                    height: 40,
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: DesignColors.lightGreenBorder,
                    backgroundColor: DesignColors.inputBg,
                    fontSize: 14,
                    color: DesignColors.charcoal,
                  },
                })}
              </View>
            ) : (
              <>
                <Pressable
                  onPress={() => {
                    const d = dateInputStart.trim().slice(0, 10);
                    setPickerDate(d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00:00') : new Date());
                    setActiveDateField('from');
                  }}
                  style={{
                    backgroundColor: DesignColors.inputBg,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: DesignColors.lightGreenBorder,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    marginBottom: 16,
                    justifyContent: 'center',
                    minHeight: 40,
                  }}
                >
                  <Text style={{ fontSize: 14, color: dateInputStart ? DesignColors.charcoal : DesignColors.mediumGray }}>
                    {dateInputStart || 'YYYY-MM-DD'}
                  </Text>
                </Pressable>
                {activeDateField === 'from' && (
                  <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display="default"
                    onChange={(_, selectedDate) => {
                      setActiveDateField(null);
                      if (selectedDate) {
                        const y = selectedDate.getFullYear();
                        const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const d = String(selectedDate.getDate()).padStart(2, '0');
                        setDateInputStart(`${y}-${m}-${d}`);
                      }
                    }}
                  />
                )}
              </>
            )}
            <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 6 }}>To</Text>
            {Platform.OS === 'web' ? (
              <View style={{ marginBottom: 20 }}>
                {createElement('input', {
                  type: 'date',
                  value: dateInputEnd,
                  onChange: (e: { target: { value: string } }) => setDateInputEnd(e.target.value || ''),
                  style: {
                    width: '100%',
                    height: 40,
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: DesignColors.lightGreenBorder,
                    backgroundColor: DesignColors.inputBg,
                    fontSize: 14,
                    color: DesignColors.charcoal,
                  },
                })}
              </View>
            ) : (
              <>
                <Pressable
                  onPress={() => {
                    const d = dateInputEnd.trim().slice(0, 10);
                    setPickerDate(d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00:00') : new Date());
                    setActiveDateField('to');
                  }}
                  style={{
                    backgroundColor: DesignColors.inputBg,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: DesignColors.lightGreenBorder,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    marginBottom: activeDateField === 'to' ? 8 : 20,
                    justifyContent: 'center',
                    minHeight: 40,
                  }}
                >
                  <Text style={{ fontSize: 14, color: dateInputEnd ? DesignColors.charcoal : DesignColors.mediumGray }}>
                    {dateInputEnd || 'YYYY-MM-DD'}
                  </Text>
                </Pressable>
                {activeDateField === 'to' && (
                  <View style={{ marginBottom: 24 }}>
                    <DateTimePicker
                      value={pickerDate}
                      mode="date"
                      display="default"
                      onChange={(_, selectedDate) => {
                        setActiveDateField(null);
                        if (selectedDate) {
                          const y = selectedDate.getFullYear();
                          const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                          const d = String(selectedDate.getDate()).padStart(2, '0');
                          setDateInputEnd(`${y}-${m}-${d}`);
                        }
                      }}
                    />
                  </View>
                )}
              </>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Pressable
                onPress={() => {
                  setDateRangeStart(null);
                  setDateRangeEnd(null);
                  setDatePickerVisible(false);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: DesignColors.lightGreenBorder,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.sageGreen }}>Clear dates</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const from = dateInputStart.trim() ? dateInputStart.trim().slice(0, 10) : null;
                  const to = dateInputEnd.trim() ? dateInputEnd.trim().slice(0, 10) : null;
                  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) setDateRangeStart(from);
                  else setDateRangeStart(null);
                  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) setDateRangeEnd(to);
                  else setDateRangeEnd(null);
                  setDatePickerVisible(false);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: DesignColors.primary,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFF' }}>Apply</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
