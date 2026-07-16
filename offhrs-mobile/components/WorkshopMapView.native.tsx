import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /**
   * Pixels of the bottom of this view covered by other UI (e.g. a draggable sheet) that the
   * map itself has no knowledge of. Without this, fit-to-pins math (and fitToCoordinates) sizes
   * the camera to the full view frame, so pins can land in the obscured area and appear "missing"
   * even though they're technically on the map — just hidden behind opaque UI on top of it.
   */
  bottomInsetPx?: number;
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

/**
 * ~25% padding around pin bounds; floor keeps a single/tight cluster from over-zooming past
 * street level.
 *
 * `bottomObscuredRatio` (0–1) is the fraction of this view's height covered by other opaque UI
 * (e.g. a draggable bottom sheet) that the map has no knowledge of. Without accounting for it,
 * a naive fit centers pins within the *full* view frame, so anything that lands in the bottom
 * portion of that frame is physically hidden behind the sheet — indistinguishable from a missing
 * pin to the user, even though it's technically "on the map". We correct for this by growing the
 * region so the pins occupy only the visible (top) fraction, pushing the extra span south, under
 * the obscured area, instead of centering it.
 */
function regionFittingBounds(coords: { lat: number; lng: number }[], bottomObscuredRatio = 0) {
  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const paddedLatDelta = Math.max((maxLat - minLat) * 1.25, 0.05);
  const longitudeDelta = Math.max((maxLng - minLng) * 1.25, 0.05);

  const ratio = Math.min(Math.max(bottomObscuredRatio, 0), 0.85);
  const totalLatDelta = ratio > 0 ? paddedLatDelta / (1 - ratio) : paddedLatDelta;
  // North (larger latitude) renders toward the top of the screen, so keep the visible portion
  // anchored at the top of the region and let the extra (obscured) span extend south.
  const visibleTopLat = midLat + paddedLatDelta / 2;
  const latitude = visibleTopLat - totalLatDelta / 2;

  return {
    latitude,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: totalLatDelta,
    longitudeDelta,
  };
}

export default function WorkshopMapView({
  events,
  loading,
  onEventPress,
  onMapPress,
  maxMarkers = DEFAULT_MAX_MARKERS,
  anchor = null,
  bottomInsetPx = 0,
}: Props) {
  const mapRef = useRef<MapView | null>(null);
  const didFitRef = useRef(false);
  const mapReadyRef = useRef(false);
  const [viewHeightPx, setViewHeightPx] = useState(0);

  // Fraction of our own height covered by other UI on top of the map — used to keep pins
  // inside the visible (top) portion instead of centering them across the full frame.
  const bottomObscuredRatio = viewHeightPx > 0 ? bottomInsetPx / viewHeightPx : 0;
  const bottomObscuredRatioRef = useRef(bottomObscuredRatio);
  bottomObscuredRatioRef.current = bottomObscuredRatio;

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

  const withCoordsRef = useRef(withCoords);
  withCoordsRef.current = withCoords;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  // Upstream react-native-maps + React Native New Architecture bug on iOS: the native layer
  // can silently drop a subset of markers when an existing MapView's marker set is *updated*
  // (reconciled) rather than freshly created — the JS-side data and props are correct and
  // present, but nothing gets drawn for those pins. Keying the MapView on the pin set forces a
  // full native remount (fresh markers, no reconciliation) whenever the set actually changes,
  // instead of patching the existing native view in place.
  const markerSetKey = useMemo(
    () => withCoords.map((e) => workshopMapMarkerKey(e)).sort().join('|'),
    [withCoords]
  );

  // First-mount region is computed directly from the pin bounds we already have (when
  // available) so the very first paint is correct-by-construction — no race with the
  // native view's own startup, which is what let `initialRegion` (anchor-only, before
  // any pins existed) silently win over a later imperative fit on slower iOS devices.
  const initialRegion = useMemo(() => {
    if (withCoords.length > 0) {
      return regionFittingBounds(
        withCoords.map((e) => ({ lat: Number(e.lat), lng: Number(e.lng) })),
        bottomObscuredRatioRef.current
      );
    }
    if (anchor) {
      return { latitude: anchor.lat, longitude: anchor.lng, latitudeDelta: 0.45, longitudeDelta: 0.45 };
    }
    return DEFAULT_REGION;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    didFitRef.current = false;
    mapReadyRef.current = false;
  }, [anchor?.lat, anchor?.lng, markerSetKey]);

  // Re-fit only once the native map has actually confirmed it's ready (`onMapReady`),
  // instead of guessing with a fixed timeout: on iOS, MapKit's native view can take
  // longer than a hardcoded delay to finish applying its own initial region, and an
  // `animateToRegion` call that lands before that finishes gets silently overridden —
  // which cropped distant pins (e.g. east-end studios) out of the visible viewport.
  const attemptFit = useCallback(() => {
    if (didFitRef.current || !mapReadyRef.current) return;
    if (loadingRef.current || withCoordsRef.current.length === 0) return;
    const region = regionFittingBounds(
      withCoordsRef.current.map((e) => ({ lat: Number(e.lat), lng: Number(e.lng) })),
      bottomObscuredRatioRef.current
    );
    mapRef.current?.animateToRegion(region, 450);
    didFitRef.current = true;
  }, []);

  const onMapReady = useCallback(() => {
    mapReadyRef.current = true;
    attemptFit();
  }, [attemptFit]);

  // If the container's real height (and thus the obscured-area ratio) wasn't known yet at the
  // time of the first fit, redo it once it is — otherwise a fit computed with ratio=0 could
  // still leave pins under the sheet.
  const didRefitForHeightRef = useRef(false);
  useEffect(() => {
    if (viewHeightPx > 0 && !didRefitForHeightRef.current) {
      didRefitForHeightRef.current = true;
      didFitRef.current = false;
      attemptFit();
    }
  }, [viewHeightPx, attemptFit]);

  useEffect(() => {
    attemptFit();
    // Safety net: if `onMapReady` never fires in some edge-case environment, assume
    // readiness after a beat and try anyway rather than leaving the map permanently
    // un-fitted. `onMapReady` (when it does fire) still wins by arriving first.
    const t = setTimeout(() => {
      mapReadyRef.current = true;
      attemptFit();
    }, 1200);
    return () => clearTimeout(t);
  }, [loading, withCoords, attemptFit]);

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
    <View
      style={styles.container}
      onLayout={(e) => setViewHeightPx(e.nativeEvent.layout.height)}
    >
      <MapView
        key={markerSetKey}
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        mapPadding={{ top: 0, right: 0, bottom: bottomInsetPx, left: 0 }}
        onMapReady={onMapReady}
        onPress={() => onMapPress?.()}
      >
        {withCoords.map((event) => {
          const markerKey = workshopMapMarkerKey(event);
          return (
            <Marker
              key={markerKey}
              identifier={markerKey}
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
          );
        })}
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
