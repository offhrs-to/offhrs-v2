import { EventCard, type Event } from '@/components/EventCard';
import WorkshopMapView from '@/components/WorkshopMapView';
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
import { useCallback, useEffect, useState } from 'react';
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
  const params = useLocalSearchParams<{ q?: string; categories?: string }>();
  const initialQ = params.q ?? '';
  const initialCategories = (params.categories ?? '').split(',').filter(Boolean);

  const [searchTerm, setSearchTerm] = useState(initialQ);
  const [selectedCategory, setSelectedCategory] = useState(
    initialCategories.length === 1 ? initialCategories[0]! : 'All'
  );
  const [userChangedCategory, setUserChangedCategory] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [events, setEvents] = useState<EventWithCoords[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quickViewEvent, setQuickViewEvent] = useState<EventWithCoords | null>(null);

  const router = useRouter();
  const { user } = useAuth();

  const effectiveCategories =
    !userChangedCategory && initialCategories.length > 0
      ? initialCategories
      : selectedCategory === 'All'
        ? []
        : [selectedCategory];

  const categoriesParam = params.categories ?? '';

  const fetchEvents = useCallback(async () => {
    const initialCats = (params.categories ?? '').split(',').filter(Boolean);
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
        .filter((e) => !e.date_iso || new Date(e.date_iso) > now);
      setEvents(list);
    } catch (e) {
      console.error('Error fetching events:', e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, userChangedCategory, selectedCategory, categoriesParam]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

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
              setSearchTerm('');
              setUserChangedCategory(true);
              setSelectedCategory('All');
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
            paddingBottom: 32,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
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
              {events.map((event) => (
                <View key={event.id} style={{ width: CARD_WIDTH }}>
                  <EventCard
                    event={event}
                    onPress={() => setQuickViewEvent(event)}
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, minHeight: 400, marginTop: 12 }}>
          <WorkshopMapView events={events} loading={loading} />
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
                  {quickViewEvent.price != null && String(quickViewEvent.price).trim() !== '' && (
                    <Text style={{ marginTop: 8, fontSize: 15, fontWeight: '600', color: DesignColors.charcoal }}>
                      {typeof quickViewEvent.price === 'string' && quickViewEvent.price.startsWith('$')
                        ? quickViewEvent.price
                        : `$${quickViewEvent.price}`}
                    </Text>
                  )}
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
    </View>
  );
}
