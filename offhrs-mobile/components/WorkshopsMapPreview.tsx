import { WORKSHOP_PREVIEW_MARKER_CAP } from '@/constants/workshops-list';
import { DesignColors } from '@/constants/design-template';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const DEFAULT_REGION = {
  latitude: 43.6532,
  longitude: -79.3832,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

export type MapPreviewEvent = {
  id: number;
  title: string;
  lat?: number | null;
  lng?: number | null;
};

type Props = {
  events: MapPreviewEvent[];
  loading?: boolean;
  height?: number;
  onPress: () => void;
};

export default function WorkshopsMapPreview({ events, loading, height = 168, onPress }: Props) {
  const withCoords = events
    .filter(
      (e) =>
        e.lat != null &&
        e.lng != null &&
        !Number.isNaN(Number(e.lat)) &&
        !Number.isNaN(Number(e.lng))
    )
    .slice(0, WORKSHOP_PREVIEW_MARKER_CAP);

  if (Platform.OS === 'web') {
    return (
      <Pressable
        onPress={onPress}
        style={{
          height,
          borderRadius: 14,
          backgroundColor: DesignColors.heroBg,
          borderWidth: 1,
          borderColor: DesignColors.lightGreenBorder,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.charcoal, textAlign: 'center' }}>
          Map preview
        </Text>
        <Text style={{ fontSize: 12, color: DesignColors.mediumGray, marginTop: 6, textAlign: 'center' }}>
          Tap to open full map
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={[styles.wrap, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        pointerEvents="none"
      >
        {withCoords.map((event) => (
          <Marker
            key={event.id}
            coordinate={{
              latitude: Number(event.lat),
              longitude: Number(event.lng),
            }}
            title={event.title}
          />
        ))}
      </MapView>
      {loading && withCoords.length === 0 ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Loading map…</Text>
        </View>
      ) : null}
      {withCoords.length === 0 && !loading ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>No pins yet — tap to explore</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DesignColors.lightGreenBorder,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(253, 252, 248, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    pointerEvents: 'none',
  },
  overlayText: {
    fontSize: 13,
    color: DesignColors.mediumGray,
    textAlign: 'center',
  },
});
