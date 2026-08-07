import CategoryFallbackImage from '@/components/CategoryFallbackImage';
import WorkshopBrowseGroupedCard from '@/components/WorkshopBrowseGroupedCard';
import WorkshopQuickViewModal from '@/components/WorkshopQuickViewModal';
import WorkshopsChrome from '@/components/WorkshopsChrome';
import { DesignColors, DesignSpacing } from '@/constants/design-template';
import { WORKSHOP_FETCH_LIMIT_SEARCH } from '@/constants/workshops-list';
import { parseCanadianPostalCode } from '@/lib/canadianPostalCode';
import { geocodeAddress } from '@/lib/geocode';
import { useAuth } from '@/contexts/AuthContext';
import {
  patchSavedEventIds,
  subscribeEventSavesChanged,
  toggleUserEventSave,
} from '@/lib/event-saves';
import { supabase } from '@/lib/supabase';
import { compareWorkshopEventsByStart, workshopEventTorontoYmd } from '@/lib/workshop-event-sort';
import { fetchWorkshopEvents, type WorkshopEventRow } from '@/lib/workshops-events-query';
import { sortWorkshopGroupsByPrice, type WorkshopPriceSort } from '@/lib/workshop-price-sort';
import { fetchNearbyVendorRows, type VendorNearbyRow } from '@/lib/workshop-vendors-nearby';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TORONTO_DEFAULT = 'Toronto, ON, Canada';
const LIST_GAP = 12;

function parseParamString(v: string | string[] | undefined): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : v[0] ?? '';
}

function workshopGroupKey(e: WorkshopEventRow): string {
  if (e.shopify_product_id) {
    const vp = e.vendor_profile_id ?? e.vendor_id ?? ''
    return `shopify\u0001${vp}\u0001${e.shopify_product_id}`
  }
  const v = e.vendor_id ?? ''
  const t = e.title.trim().toLowerCase().replace(/\s+/g, ' ')
  return `${v}\u0001${t}`
}

function searchResultGroupKey(e: WorkshopEventRow): string {
  if (e.recurrence === 'daily' || e.recurrence === 'weekly') return `rec:${e.id}`;
  if (e.workshop_series === 'multi_week') return `series:${e.id}`;
  const ymd = workshopEventTorontoYmd(e);
  return `${ymd}\u0001${workshopGroupKey(e)}`;
}

export default function WorkshopSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ q?: string }>();

  const paramQ = parseParamString(params.q);

  const [searchTerm, setSearchTerm] = useState(paramQ);

  const [profileCoords, setProfileCoords] = useState<{ lat: number; lng: number; postal: string | null } | null>(
    null
  );
  const [anchorCoords, setAnchorCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationText, setLocationText] = useState('');
  const [locationEntryMode, setLocationEntryMode] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [events, setEvents] = useState<WorkshopEventRow[]>([]);
  const [nearbyRows, setNearbyRows] = useState<VendorNearbyRow[]>([]);
  const [geoBusy, setGeoBusy] = useState(false);

  const [savedEventIds, setSavedEventIds] = useState<Set<number>>(new Set());
  const [quickViewEvent, setQuickViewEvent] = useState<WorkshopEventRow | null>(null);
  const [quickViewSaving, setQuickViewSaving] = useState(false);
  const [profileLocation, setProfileLocation] = useState<{
    lat: number;
    lng: number;
    postal_code: string | null;
  } | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [priceSort, setPriceSort] = useState<WorkshopPriceSort>('default');

  const isSearching = searchTerm.trim().length > 0;

  useEffect(() => {
    setSearchTerm(paramQ);
  }, [paramQ]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        setSavedEventIds(new Set());
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
    if (!user?.id) {
      setProfileCoords(null);
      return;
    }
    supabase
      .from('profiles')
      .select('location_lat, location_lng, postal_code')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.location_lat != null && data?.location_lng != null) {
          setProfileCoords({
            lat: Number(data.location_lat),
            lng: Number(data.location_lng),
            postal: data.postal_code ?? null,
          });
        } else {
          setProfileCoords(null);
        }
      });
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (profileCoords) {
        if (!cancelled) {
          setAnchorCoords({ lat: profileCoords.lat, lng: profileCoords.lng });
          setLocationText(profileCoords.postal || 'Your saved location');
          setLocationEntryMode(false);
        }
        return;
      }
      const c = await geocodeAddress(TORONTO_DEFAULT);
      if (!cancelled) {
        if (c) setAnchorCoords(c);
        setLocationText(TORONTO_DEFAULT);
        setLocationEntryMode(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileCoords]);

  const reloadSearchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const rows = await fetchWorkshopEvents({
        searchTerm,
        categories: [],
        dateRangeStart: null,
        dateRangeEnd: null,
        limit: WORKSHOP_FETCH_LIMIT_SEARCH,
      });
      setEvents(rows);
      setNearbyRows([]);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [searchTerm]);

  const reloadNearbyStudios = useCallback(async () => {
    if (!anchorCoords) {
      setNearbyRows([]);
      setEventsLoading(false);
      return;
    }
    setEventsLoading(true);
    try {
      const rows = await fetchNearbyVendorRows(anchorCoords);
      setNearbyRows(rows);
      setEvents([]);
    } catch {
      setNearbyRows([]);
    } finally {
      setEventsLoading(false);
    }
  }, [anchorCoords]);

  useEffect(() => {
    if (isSearching) {
      void reloadSearchEvents();
      return;
    }
    void reloadNearbyStudios();
  }, [isSearching, reloadSearchEvents, reloadNearbyStudios]);

  const workshopGroups = useMemo(() => {
    if (!isSearching) return [];
    const map = new Map<string, WorkshopEventRow[]>();
    for (const e of events) {
      const k = searchResultGroupKey(e);
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    const groups = [...map.values()].map((g) => [...g].sort(compareWorkshopEventsByStart));
    return sortWorkshopGroupsByPrice(groups, priceSort);
  }, [events, isSearching, priceSort]);

  useEffect(() => {
    return subscribeEventSavesChanged(({ eventId, saved }) => {
      setSavedEventIds((prev) => patchSavedEventIds(prev, eventId, saved));
    });
  }, []);

  const quickViewEventId = quickViewEvent?.id != null ? Number(quickViewEvent.id) : null;
  const quickViewSaved = quickViewEventId != null && savedEventIds.has(quickViewEventId);

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
  }, [quickViewEvent?.id, quickViewSaving, router, savedEventIds, user?.id]);

  const applyPostal = async (raw: string) => {
    const norm = parseCanadianPostalCode(raw);
    if (!norm) return;
    setGeoBusy(true);
    try {
      const c = await geocodeAddress(`${norm}, Canada`);
      if (c) {
        setAnchorCoords(c);
        setLocationText(norm);
        setLocationEntryMode(false);
      }
    } finally {
      setGeoBusy(false);
    }
  };

  const useCurrentLocation = async () => {
    setGeoBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setAnchorCoords({ lat, lng });
      setLocationText('Current location');
      setLocationEntryMode(false);
    } finally {
      setGeoBusy(false);
    }
  };

  const renderVendor = ({ item }: { item: VendorNearbyRow }) => {
    return (
      <Pressable
        onPress={() => router.push(`/vendors/${item.vendor_id}`)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: DesignColors.lightGreenBorder,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            overflow: 'hidden',
            backgroundColor: DesignColors.inputBg,
            marginRight: 12,
          }}
        >
          <CategoryFallbackImage
            imageUrl={item.image_url}
            category={item.category}
            style={{ width: 48, height: 48 }}
            contentFit="cover"
            recyclingKey={`vendor-search-${item.vendor_id}`}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: DesignColors.charcoal }}>{item.name}</Text>
          <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginTop: 2 }}>
            {Math.round(item.distanceKm * 10) / 10} km
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderWorkshopGroup = ({ item: group }: { item: WorkshopEventRow[] }) => (
      <View style={{ marginBottom: LIST_GAP }}>
        <WorkshopBrowseGroupedCard
          group={group}
          profileLocation={profileLocation}
          savedEventIds={savedEventIds}
          onSaveChange={(id, saved) => {
            setSavedEventIds((prev) => {
              const next = new Set(prev);
              if (saved) next.add(id);
              else next.delete(id);
              return next;
            });
          }}
          onOpenQuickView={setQuickViewEvent}
        />
      </View>
  );

  const listHeader = isSearching ? (
    <View style={{ paddingTop: 8, paddingBottom: 8 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: DesignColors.charcoal }}>Workshops</Text>
      {!eventsLoading ? (
        <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginTop: 4 }}>
          {workshopGroups.length} match{workshopGroups.length === 1 ? '' : 'es'}
        </Text>
      ) : null}
    </View>
  ) : (
    <View style={{ paddingHorizontal: DesignSpacing.horizontalPadding, paddingTop: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: DesignColors.mediumGray, marginBottom: 6 }}>
        Location
      </Text>
      <TextInput
        value={locationText}
        placeholder={locationEntryMode ? 'Enter your postal code' : ''}
        placeholderTextColor={DesignColors.mediumGray}
        onChangeText={(t) => {
          setLocationText(t);
          setLocationEntryMode(t.trim() === '');
        }}
        onFocus={() => {
          if (!locationEntryMode && (locationText === TORONTO_DEFAULT || locationText === 'Your saved location')) {
            setLocationText('');
            setLocationEntryMode(true);
          }
        }}
        onBlur={() => {
          const trimmed = locationText.trim();
          if (trimmed) {
            void applyPostal(trimmed);
            return;
          }
          if (!locationEntryMode) return;
          if (profileCoords) {
            setAnchorCoords({ lat: profileCoords.lat, lng: profileCoords.lng });
            setLocationText(profileCoords.postal || 'Your saved location');
          } else {
            void (async () => {
              const c = await geocodeAddress(TORONTO_DEFAULT);
              if (c) setAnchorCoords(c);
              setLocationText(TORONTO_DEFAULT);
            })();
          }
          setLocationEntryMode(false);
        }}
        autoCapitalize="characters"
        style={{
          backgroundColor: DesignColors.inputBg,
          borderRadius: 9999,
          borderWidth: 1,
          borderColor: DesignColors.lightGreenBorder,
          paddingHorizontal: 14,
          paddingVertical: 10,
          fontSize: 14,
          color: DesignColors.charcoal,
          marginBottom: locationEntryMode ? 10 : 0,
        }}
      />
      {locationEntryMode ? (
        <Pressable
          onPress={useCurrentLocation}
          disabled={geoBusy}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, marginBottom: 8 }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: DesignColors.inputBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialCommunityIcons name="crosshairs-gps" size={22} color={DesignColors.primary} />
          </View>
          <Text style={{ fontSize: 15, color: DesignColors.charcoal }}>Current location</Text>
          {geoBusy ? <ActivityIndicator size="small" color={DesignColors.primary} /> : null}
        </Pressable>
      ) : null}

      <Text
        style={{
          fontSize: 15,
          fontWeight: '700',
          color: DesignColors.charcoal,
          marginTop: 16,
          marginBottom: 8,
        }}
      >
        Nearby
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: DesignColors.creamBg, paddingBottom: insets.bottom }}>
      <WorkshopsChrome
        showBack
        hideDateAndClear
        onBackPress={() => router.back()}
        searchValue={searchTerm}
        onSearchChangeText={setSearchTerm}
        showPriceFilter={isSearching}
        priceSort={priceSort}
        onPriceSortChange={setPriceSort}
      />

      {eventsLoading ? (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <ActivityIndicator color={DesignColors.primary} />
        </View>
      ) : isSearching ? (
        <FlatList
          data={workshopGroups}
          keyExtractor={(group) => {
            const anchor = group[0]!;
            return `${anchor.vendor_id ?? 'nv'}-${anchor.title}-${group.map((g) => g.id).join('-')}`;
          }}
          renderItem={renderWorkshopGroup}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{
            paddingHorizontal: DesignSpacing.horizontalPadding,
            paddingBottom: 24,
          }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={{ color: DesignColors.mediumGray, paddingVertical: 16, textAlign: 'center' }}>
              No workshops match your search yet.
            </Text>
          }
        />
      ) : (
        <FlatList
          data={nearbyRows}
          keyExtractor={(it) => it.vendor_id}
          renderItem={renderVendor}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{
            paddingHorizontal: DesignSpacing.horizontalPadding,
            paddingBottom: 24,
          }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={{ color: DesignColors.mediumGray, paddingVertical: 16 }}>
              {anchorCoords
                ? 'No nearby studios with mapped locations yet.'
                : 'Set a location above to browse nearby studios.'}
            </Text>
          }
        />
      )}

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
      />
    </View>
  );
}
