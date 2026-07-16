import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';

import CategoryFallbackImage from '@/components/CategoryFallbackImage';
import { DesignColors } from '@/constants/design-template';
import { canMountNativeMapView } from '@/lib/android-google-maps';
import { vendorPagePath } from '@/lib/workshop-vendor-display';
import WorkshopSalePrice from '@/components/WorkshopSalePrice';
import {
  dedupeWorkshopMapMarkerEvents,
  workshopHasMapCoordinates,
  workshopMapMarkerKey,
} from '@/lib/workshop-map-coordinates';
import { haversineKm } from '@/lib/distance';
import type { WorkshopEventRow } from '@/lib/workshops-events-query';

/** ~45km span so GTA pins are visible without hunting. */
const DEFAULT_REGION = {
  latitude: 43.6532,
  longitude: -79.3832,
  latitudeDelta: 0.45,
  longitudeDelta: 0.45,
};

type Props = {
  events: WorkshopEventRow[];
  loading: boolean;
  /** When provided, tapping a marker opens this (e.g. quick-view modal); avoids broken touches inside callout. */
  onEventPress?: (event: WorkshopEventRow) => void;
  /** Fires when the user taps the map background (not a marker). */
  onMapPress?: () => void;
  /** Max markers to mount (native maps choke on 500+). */
  maxMarkers?: number;
  /** Prefer closest pins when over maxMarkers (user location or city default). */
  anchor?: { lat: number; lng: number } | null;
};

const DEFAULT_MAX_MARKERS = 280;

function MapCalloutCard({ event, onOpenSheet }: { event: WorkshopEventRow; onOpenSheet?: (e: WorkshopEventRow) => void }) {
  const router = useRouter();

  const handleBook = () => {
    if (onOpenSheet) {
      onOpenSheet(event);
      return;
    }
    const url = event.external_link?.trim();
    if (url) Linking.openURL(url);
  };

  return (
    <View style={calloutStyles.card}>
      <View style={calloutStyles.imageWrap}>
        <CategoryFallbackImage
          imageUrl={event.image_url}
          category={event.category}
          style={calloutStyles.image}
          contentFit="cover"
          recyclingKey={`map-callout-${event.id}`}
        />
      </View>
      <View style={calloutStyles.body}>
        <Text style={calloutStyles.title} numberOfLines={2}>{event.title}</Text>
        {event.date ? (
          <Text style={calloutStyles.meta} numberOfLines={1}>{event.date}</Text>
        ) : null}
        {event.location ? (
          <Text style={calloutStyles.meta} numberOfLines={1}>{event.location}</Text>
        ) : null}
        <View style={{ marginTop: 6 }}>
          <WorkshopSalePrice event={event} />
        </View>
        <View style={calloutStyles.actions}>
          {event.vendor_id ? (
            <Pressable
              onPress={() => {
                const path = vendorPagePath(event);
                if (path) router.push(path);
              }}
              style={calloutStyles.vendorBtn}
            >
              <Text style={calloutStyles.vendorBtnText}>Vendor</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={handleBook} style={calloutStyles.bookBtn}>
            <Text style={calloutStyles.bookBtnText}>Book</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const calloutStyles = StyleSheet.create({
  card: {
    width: 280,
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DesignColors.lightGreenBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  imageWrap: {
    width: '100%',
    height: 100,
    backgroundColor: DesignColors.inputBg,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  body: {
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: DesignColors.charcoal,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: DesignColors.mediumGray,
  },
  price: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: DesignColors.charcoal,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  vendorBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DesignColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: DesignColors.primary,
  },
  bookBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: DesignColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
});

export default function WorkshopMapView({
  events,
  loading,
  onEventPress,
  onMapPress,
  maxMarkers = DEFAULT_MAX_MARKERS,
  anchor = null,
}: Props) {
  const mapRef = useRef<MapView | null>(null);
  const didFitRef = useRef(false);

  const withCoords = useMemo(() => {
    const filtered = dedupeWorkshopMapMarkerEvents(events.filter(workshopHasMapCoordinates));
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

  const initialRegion = useMemo(
    () =>
      anchor
        ? {
            latitude: anchor.lat,
            longitude: anchor.lng,
            latitudeDelta: 0.45,
            longitudeDelta: 0.45,
          }
        : DEFAULT_REGION,
    [anchor]
  );

  useEffect(() => {
    didFitRef.current = false;
  }, [anchor?.lat, anchor?.lng]);

  useEffect(() => {
    if (loading || withCoords.length === 0 || didFitRef.current) return;
    // Compute the fit region ourselves instead of calling native fitToCoordinates:
    // on iOS, react-native-maps' fitToCoordinates delegates to Apple MapKit, which
    // (unlike Google Maps on Android) can clip pins far from the densest cluster and
    // misbehaves whenever the MapView isn't exactly 100% of the screen height — true
    // here since a header and draggable list sheet share the screen with the map.
    // A manually computed region + animateToRegion is layout-independent and renders
    // identically on both platforms, so distant pins (e.g. east-end studios) always fit.
    const lats = withCoords.map((e) => Number(e.lat));
    const lngs = withCoords.map((e) => Number(e.lng));
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    // ~25% padding around the pin bounds, with a floor so a single/tight cluster of
    // pins doesn't over-zoom past street level.
    const latitudeDelta = Math.max((maxLat - minLat) * 1.25, 0.05);
    const longitudeDelta = Math.max((maxLng - minLng) * 1.25, 0.05);
    const t = setTimeout(() => {
      mapRef.current?.animateToRegion(
        { latitude: centerLat, longitude: centerLng, latitudeDelta, longitudeDelta },
        450
      );
      didFitRef.current = true;
    }, 350);
    return () => clearTimeout(t);
  }, [loading, withCoords]);

  if (!canMountNativeMapView()) {
    return (
      <View style={[styles.container, styles.noKeyFallback]}>
        <Text style={styles.noKeyText}>
          Map is unavailable until a Google Maps API key is configured for this Android build. You can still use the
          list below.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        onPress={() => onMapPress?.()}
      >
        {withCoords.map((event) => (
          <Marker
            key={workshopMapMarkerKey(event)}
            coordinate={{
              latitude: Number(event.lat),
              longitude: Number(event.lng),
            }}
            title={event.title}
            onPress={() => onEventPress?.(event)}
          >
            {!onEventPress && (
              <Callout tooltip>
                <MapCalloutCard event={event} />
              </Callout>
            )}
          </Marker>
        ))}
      </MapView>
      {withCoords.length === 0 && !loading && (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyText}>
            No events with location to show on map.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 300,
  },
  noKeyFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(245, 245, 245, 0.95)',
  },
  noKeyText: {
    textAlign: 'center',
    color: DesignColors.mediumGray,
    fontSize: 15,
    lineHeight: 22,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245, 245, 245, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B6B6B',
    fontSize: 15,
  },
});
