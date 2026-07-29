import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Callout, Marker, type Region } from 'react-native-maps';

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

/**
 * Default full-map focus: north of the waterfront so the visible pane (above the list sheet)
 * frames downtown streets — City Hall (~43.65) sits too close to the lake once the sheet
 * covers the bottom half and `mapPadding` recenters the camera.
 */
const DOWNTOWN_TORONTO = { lat: 43.6705, lng: -79.386 };
/** City-scale opening zoom — wide enough for core + near-downtown studios. */
const DEFAULT_DELTA = 0.16;
/** Cap auto-fit so we don't zoom out to lake-wide GTA, but still include most city pins. */
const MAX_FIT_DELTA = 0.2;

const DEFAULT_REGION: Region = {
  latitude: DOWNTOWN_TORONTO.lat,
  longitude: DOWNTOWN_TORONTO.lng,
  latitudeDelta: DEFAULT_DELTA,
  longitudeDelta: DEFAULT_DELTA,
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

function regionFittingBounds(
  coords: { lat: number; lng: number }[],
  _bottomObscuredRatio = 0,
  preferredCenter?: { lat: number; lng: number } | null
): Region {
  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  let midLat = (minLat + maxLat) / 2;
  let midLng = (minLng + maxLng) / 2;
  let latitudeDelta = Math.max((maxLat - minLat) * 1.25, 0.05);
  let longitudeDelta = Math.max((maxLng - minLng) * 1.25, 0.05);

  const center = preferredCenter ?? DOWNTOWN_TORONTO;
  if (latitudeDelta > MAX_FIT_DELTA || longitudeDelta > MAX_FIT_DELTA) {
    midLat = center.lat;
    midLng = center.lng;
    latitudeDelta = MAX_FIT_DELTA;
    longitudeDelta = MAX_FIT_DELTA;
  } else {
    midLat = midLat * 0.35 + center.lat * 0.65;
    midLng = midLng * 0.35 + center.lng * 0.65;
    latitudeDelta = Math.min(Math.max(latitudeDelta, DEFAULT_DELTA * 0.85), MAX_FIT_DELTA);
    longitudeDelta = Math.min(Math.max(longitudeDelta, DEFAULT_DELTA * 0.85), MAX_FIT_DELTA);
  }

  return {
    latitude: midLat,
    longitude: midLng,
    latitudeDelta,
    longitudeDelta,
  };
}

/**
 * Default native pin only — no custom Marker children.
 * Custom views + dynamic add/remove during zoom crash Expo Go (Fabric insertObject:nil).
 */
const VendorPinMarker = memo(function VendorPinMarker({
  id,
  latitude,
  longitude,
  title,
  event,
  onEventPress,
}: {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  event: WorkshopEventRow;
  onEventPress?: (event: WorkshopEventRow) => void;
}) {
  if (onEventPress) {
    return (
      <Marker
        identifier={id}
        coordinate={{ latitude, longitude }}
        title={title}
        tracksViewChanges={false}
        onPress={() => onEventPress(event)}
      />
    );
  }

  return (
    <Marker
      identifier={id}
      coordinate={{ latitude, longitude }}
      title={title}
      tracksViewChanges={false}
    >
      <Callout tooltip>
        <MapCalloutCard event={event} />
      </Callout>
    </Marker>
  );
});

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
  const mapReadyRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [viewHeightPx, setViewHeightPx] = useState(0);
  const didOpeningFitRef = useRef(false);
  const didPadFitRef = useRef(false);
  const fitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /**
   * Stable pin list for the native map. Built once per pin-set; never rebuilt from camera
   * region. Region-driven clustering was crashing Expo Go when the opening zoom-out swapped
   * markers mid-animation.
   */
  const pinSignature = useMemo(
    () => withCoords.map((e) => workshopMapMarkerKey(e)).sort().join('|'),
    [withCoords]
  );

  const [mountedPins, setMountedPins] = useState<WorkshopEventRow[]>([]);
  const lastMountedSignatureRef = useRef('');

  const openingRegion = useMemo(() => {
    if (withCoords.length > 0) {
      return regionFittingBounds(
        withCoords.map((e) => ({ lat: Number(e.lat), lng: Number(e.lng) })),
        bottomObscuredRatioRef.current,
        anchor
      );
    }
    if (anchor) {
      return {
        latitude: anchor.lat,
        longitude: anchor.lng,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      };
    }
    return DEFAULT_REGION;
  }, [withCoords, anchor]);

  const runOpeningFit = useCallback(() => {
    if (!mapRef.current || withCoordsRef.current.length === 0) return;
    const region = regionFittingBounds(
      withCoordsRef.current.map((e) => ({ lat: Number(e.lat), lng: Number(e.lng) })),
      bottomObscuredRatioRef.current,
      anchor
    );
    mapRef.current.animateToRegion(region, 400);
  }, [anchor]);

  // Mount every vendor pin in one transaction after MapKit is ready — then fit once.
  // Do not add/remove markers afterward based on zoom (that path crashes Fabric).
  useEffect(() => {
    if (!mapReady || loading || withCoords.length === 0) {
      if (!loading && withCoords.length === 0) {
        setMountedPins([]);
        lastMountedSignatureRef.current = '';
        didOpeningFitRef.current = false;
      }
      return;
    }

    if (lastMountedSignatureRef.current === pinSignature && mountedPins.length > 0) {
      return;
    }

    if (mountTimerRef.current) clearTimeout(mountTimerRef.current);
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);

    mountTimerRef.current = setTimeout(() => {
      lastMountedSignatureRef.current = pinSignature;
      setMountedPins(withCoordsRef.current);
      didOpeningFitRef.current = false;

      // Fit after pins are committed — camera-only, marker set stays fixed.
      fitTimerRef.current = setTimeout(() => {
        if (didOpeningFitRef.current) return;
        didOpeningFitRef.current = true;
        runOpeningFit();
      }, 120);
    }, 80);

    return () => {
      if (mountTimerRef.current) clearTimeout(mountTimerRef.current);
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    };
  }, [mapReady, loading, pinSignature, withCoords.length, mountedPins.length, runOpeningFit]);

  // Sheet height arrives after first paint — adjust camera only (markers untouched).
  useEffect(() => {
    if (!mapReady || mountedPins.length === 0 || bottomInsetPx <= 0 || didPadFitRef.current) {
      return;
    }
    didPadFitRef.current = true;
    const t = setTimeout(() => {
      runOpeningFit();
    }, 100);
    return () => clearTimeout(t);
  }, [bottomInsetPx, mapReady, mountedPins.length, runOpeningFit]);

  useEffect(() => {
    didPadFitRef.current = false;
    didOpeningFitRef.current = false;
    mapReadyRef.current = false;
    setMapReady(false);
    setMountedPins([]);
    lastMountedSignatureRef.current = '';
  }, [anchor?.lat, anchor?.lng]);

  const onMapReady = useCallback(() => {
    mapReadyRef.current = true;
    setMapReady(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!mapReadyRef.current) {
        mapReadyRef.current = true;
        setMapReady(true);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, []);

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
      {/*
        Never remount MapView via changing `key`. Never rebuild the Marker list from camera
        region. Both patterns abort Expo Go / Fabric (insertObject:atIndex: nil / OOB).
      */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={openingRegion}
        showsUserLocation
        mapPadding={{ top: 0, right: 0, bottom: bottomInsetPx, left: 0 }}
        onMapReady={onMapReady}
        onPress={() => onMapPress?.()}
      >
        {mountedPins.map((event) => {
          const id = workshopMapMarkerKey(event);
          return (
            <VendorPinMarker
              key={id}
              id={id}
              latitude={Number(event.lat)}
              longitude={Number(event.lng)}
              title={event.title}
              event={event}
              onEventPress={onEventPress}
            />
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
