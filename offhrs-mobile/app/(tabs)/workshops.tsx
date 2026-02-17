import { EventCard, CARD_TOTAL_HEIGHT, type Event } from '@/components/EventCard';
import WorkshopMapView from '@/components/WorkshopMapView';
import { geocodeAddress } from '@/lib/geocode';
import { haversineKm } from '@/lib/distance';
import {
  DesignColors,
  DesignSpacing,
  DesignSizes,
} from '@/constants/design-template';
import { CATEGORIES as CATEGORY_LIST } from '@/constants/categories';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createElement, useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
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
  const params = useLocalSearchParams<{ q?: string; categories?: string; address?: string }>();
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
  const [quickViewSaved, setQuickViewSaved] = useState(false);
  const [quickViewSaving, setQuickViewSaving] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState<string | null>(null);
  const [dateRangeEnd, setDateRangeEnd] = useState<string | null>(null);
  const [dateInputStart, setDateInputStart] = useState('');
  const [dateInputEnd, setDateInputEnd] = useState('');
  const [activeDateField, setActiveDateField] = useState<'from' | 'to' | null>(null);
  const [pickerDate, setPickerDate] = useState(() => new Date());

  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !quickViewEvent?.id) {
      setQuickViewSaved(false);
      return;
    }
    supabase
      .from('user_event_saves')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_id', quickViewEvent.id)
      .maybeSingle()
      .then(({ data }) => setQuickViewSaved(!!data));
  }, [user?.id, quickViewEvent?.id]);

  const handleQuickViewSave = useCallback(async () => {
    if (!user?.id || !quickViewEvent?.id || quickViewSaving) return;
    setQuickViewSaving(true);
    if (quickViewSaved) {
      await supabase
        .from('user_event_saves')
        .delete()
        .eq('user_id', user.id)
        .eq('event_id', quickViewEvent.id);
      setQuickViewSaved(false);
    } else {
      await supabase
        .from('user_event_saves')
        .insert({ user_id: user.id, event_id: quickViewEvent.id });
      setQuickViewSaved(true);
    }
    setQuickViewSaving(false);
  }, [user?.id, quickViewEvent?.id, quickViewSaved, quickViewSaving]);

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
      let query = supabase
        .from('events')
        .select('id, title, date, location, image_url, price, external_link, category, lat, lng, vendor_id')
        .order('date', { ascending: true });

      if (searchTerm.trim()) {
        query = query.or(
          `title.ilike.%${searchTerm.trim()}%,category.ilike.%${searchTerm.trim()}%`
        );
      }
      if (effective.length > 0) {
        query = query.in('category', effective);
      }

      const { data, error } = await query;
      if (error) throw error;

      const now = new Date();
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
        }))
        // Exclude expired workshops (event date in the past); they remain visible in /admin for redirect review
        .filter((e) => !e.date_iso || new Date(e.date_iso) > now)
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
      setEvents(list);
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
          paddingBottom: 6,
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
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: DesignSpacing.horizontalPadding,
            paddingTop: 12,
            paddingBottom: Platform.OS === 'ios' ? 120 : 116,
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
              {events.map((event) => {
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
                  <View key={event.id} style={{ width: CARD_WIDTH, height: CARD_TOTAL_HEIGHT }}>
                    <EventCard
                      event={event}
                      distanceKm={distanceKm != null ? Math.round(distanceKm * 10) / 10 : undefined}
                      onPress={() => setQuickViewEvent(event)}
                    />
                  </View>
                );
              })}
            </View>
          )}
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
            bottom: 84,
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
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onPress={() => setQuickViewEvent(null)}
        >
          <Pressable
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: '#FFF',
              borderRadius: 20,
              overflow: 'hidden',
              paddingBottom: 20,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {quickViewEvent && (
              <>
                <View style={{ height: 200, width: '100%', backgroundColor: DesignColors.inputBg, position: 'relative' }}>
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
                  {quickViewEvent.id != null && user?.id && (
                    <Pressable
                      onPress={handleQuickViewSave}
                      disabled={quickViewSaving}
                      style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 20,
                        backgroundColor: 'rgba(255,255,255,0.9)',
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: quickViewSaved ? DesignColors.primary : DesignColors.charcoal }}>
                        {quickViewSaved ? 'Saved' : 'Save'}
                      </Text>
                    </Pressable>
                  )}
                </View>
                <View style={{ padding: 16 }}>
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
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
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
                        if (user?.id) {
                          const apiUrl = process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:3000';
                          try {
                            const { data: { session } } = await supabase.auth.getSession();
                            const token = session?.access_token;
                            if (token) {
                              await fetch(`${apiUrl}/api/book`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                  event_id: quickViewEvent.id,
                                  event_title: quickViewEvent.title,
                                }),
                              });
                            }
                          } catch {}
                        }
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
          </Pressable>
        </Pressable>
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
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
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
                  <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
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
                )}
              </>
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
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
