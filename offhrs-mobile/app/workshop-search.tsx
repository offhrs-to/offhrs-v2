import CategoryFallbackImage from '@/components/CategoryFallbackImage';
import WorkshopsChrome from '@/components/WorkshopsChrome';
import { DesignColors, DesignSpacing } from '@/constants/design-template';
import { WORKSHOP_FETCH_LIMIT_SEARCH } from '@/constants/workshops-list';
import { parseCanadianPostalCode } from '@/lib/canadianPostalCode';
import { geocodeAddress } from '@/lib/geocode';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchWorkshopEvents } from '@/lib/workshops-events-query';
import { buildVendorNearbyList, type VendorNearbyRow } from '@/lib/workshop-vendors-nearby';
import * as Location from 'expo-location';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TORONTO_DEFAULT = 'Toronto, ON, Canada';

function parseParamString(v: string | string[] | undefined): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : v[0] ?? '';
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
  const [events, setEvents] = useState<Awaited<ReturnType<typeof fetchWorkshopEvents>>>([]);
  const [vendorNames, setVendorNames] = useState<Record<string, string>>({});
  const [geoBusy, setGeoBusy] = useState(false);

  useEffect(() => {
    setSearchTerm(paramQ);
  }, [paramQ]);

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

  const reloadEvents = useCallback(async () => {
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
      const vids = [...new Set(rows.map((r) => r.vendor_id).filter(Boolean))] as string[];
      if (vids.length === 0) {
        setVendorNames({});
        return;
      }
      const { data: vendors } = await supabase.from('vendors').select('id, name').in('id', vids);
      const map: Record<string, string> = {};
      (vendors ?? []).forEach((v) => {
        map[v.id] = v.name ?? 'Vendor';
      });
      setVendorNames(map);
    } catch {
      setEvents([]);
      setVendorNames({});
    } finally {
      setEventsLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    reloadEvents();
  }, [reloadEvents]);

  const nearbyRows = useMemo(() => {
    if (!anchorCoords) return [];
    return buildVendorNearbyList(events, vendorNames, anchorCoords);
  }, [events, vendorNames, anchorCoords]);

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

  return (
    <View style={{ flex: 1, backgroundColor: DesignColors.creamBg, paddingBottom: insets.bottom }}>
      <WorkshopsChrome
        showBack
        hideDateAndClear
        onBackPress={() => router.back()}
        searchValue={searchTerm}
        onSearchChangeText={setSearchTerm}
      />

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

      {eventsLoading ? (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <ActivityIndicator color={DesignColors.primary} />
        </View>
      ) : (
        <FlatList
          data={nearbyRows}
          keyExtractor={(it) => it.vendor_id}
          renderItem={renderVendor}
          contentContainerStyle={{
            paddingHorizontal: DesignSpacing.horizontalPadding,
            paddingBottom: 24,
          }}
          ListEmptyComponent={
            <Text style={{ color: DesignColors.mediumGray, paddingVertical: 16 }}>
              No vendors with locations match your search yet.
            </Text>
          }
        />
      )}

    </View>
  );
}
