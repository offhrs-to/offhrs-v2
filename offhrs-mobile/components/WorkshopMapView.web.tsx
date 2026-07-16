import { useMemo } from 'react';
import { Text, View, ScrollView, Pressable } from 'react-native';

import { DesignColors } from '@/constants/design-template';
import { haversineKm } from '@/lib/distance';
import type { WorkshopEventRow } from '@/lib/workshops-events-query';

type Props = {
  events: WorkshopEventRow[];
  loading: boolean;
  onEventPress?: (event: WorkshopEventRow) => void;
  onMapPress?: () => void;
  maxMarkers?: number;
  /** Prefer closest pins when over maxMarkers (user location or city default). */
  anchor?: { lat: number; lng: number } | null;
};

const DEFAULT_MAX_MARKERS = 280;

export default function WorkshopMapView({
  events,
  loading,
  onEventPress,
  maxMarkers = DEFAULT_MAX_MARKERS,
  anchor = null,
}: Props) {
  const withCoords = useMemo(() => {
    const filtered = events.filter(
      (e) => e.lat != null && e.lng != null && !isNaN(Number(e.lat)) && !isNaN(Number(e.lng))
    );
    if (filtered.length <= maxMarkers) return filtered;
    if (anchor) {
      return [...filtered]
        .sort((a, b) => {
          const da = haversineKm(anchor.lat, anchor.lng, Number(a.lat), Number(a.lng));
          const db = haversineKm(anchor.lat, anchor.lng, Number(b.lat), Number(b.lng));
          return da - db;
        })
        .slice(0, maxMarkers);
    }
    return filtered.slice(0, maxMarkers);
  }, [events, maxMarkers, anchor]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: DesignColors.mediumGray }}>Loading map...</Text>
      </View>
    );
  }

  if (withCoords.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: DesignColors.mediumGray, textAlign: 'center' }}>
          No events with location to show on map.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: DesignColors.charcoal,
          marginBottom: 16,
        }}
      >
        Map view on web: tap an event to open in Google Maps
      </Text>
      {withCoords.map((e) => (
        <Pressable
          key={e.id}
          onPress={() => {
            if (onEventPress) {
              onEventPress(e);
              return;
            }
            const url = `https://www.google.com/maps/search/?api=1&query=${Number(e.lat)},${Number(e.lng)}`;
            if (typeof window !== 'undefined') window.open(url, '_blank');
          }}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            marginBottom: 8,
            borderRadius: 12,
            backgroundColor: '#FFF',
            borderWidth: 1,
            borderColor: DesignColors.lightGreenBorder,
          }}
        >
          <Text style={{ fontWeight: '600', color: DesignColors.charcoal }} numberOfLines={1}>
            {e.title}
          </Text>
          <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginTop: 4 }}>
            {e.location || 'View on map'}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
