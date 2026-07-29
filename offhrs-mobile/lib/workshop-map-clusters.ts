import type { WorkshopEventRow } from '@/lib/workshops-events-query';
import { workshopMapMarkerKey } from '@/lib/workshop-map-coordinates';

export type MapClusterRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type WorkshopMapClusterItem =
  | {
      kind: 'point';
      id: string;
      lat: number;
      lng: number;
      event: WorkshopEventRow;
    }
  | {
      kind: 'cluster';
      id: string;
      lat: number;
      lng: number;
      count: number;
      events: WorkshopEventRow[];
    };

function shortHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * Group nearby pins into clusters for the current camera.
 * Threshold scales with zoom so overlapping city-scale pins become a count bubble,
 * then split apart again as the user zooms in.
 */
export function clusterWorkshopMapEvents(
  events: WorkshopEventRow[],
  region: MapClusterRegion | null
): WorkshopMapClusterItem[] {
  const points = events.map((event) => ({
    id: workshopMapMarkerKey(event),
    lat: Number(event.lat),
    lng: Number(event.lng),
    event,
  }));

  if (points.length === 0) return [];

  const latDelta = region?.latitudeDelta ?? 0.16;
  const lngDelta = region?.longitudeDelta ?? 0.16;
  const span = Math.max(latDelta, lngDelta);
  // ~5% of visible span; clamp so dense downtown pins cluster at city zoom
  // but separate once the camera is neighborhood-scale.
  const threshold = Math.min(Math.max(span * 0.045, 0.0025), 0.03);

  const used = new Set<number>();
  const out: WorkshopMapClusterItem[] = [];

  for (let i = 0; i < points.length; i++) {
    if (used.has(i)) continue;
    const group = [points[i]];
    used.add(i);

    let sumLat = points[i].lat;
    let sumLng = points[i].lng;

    for (let j = i + 1; j < points.length; j++) {
      if (used.has(j)) continue;
      const dLat = Math.abs(points[j].lat - sumLat / group.length);
      const dLng = Math.abs(points[j].lng - sumLng / group.length);
      if (dLat <= threshold && dLng <= threshold) {
        group.push(points[j]);
        used.add(j);
        sumLat += points[j].lat;
        sumLng += points[j].lng;
      }
    }

    if (group.length === 1) {
      out.push({
        kind: 'point',
        id: group[0].id,
        lat: group[0].lat,
        lng: group[0].lng,
        event: group[0].event,
      });
      continue;
    }

    const ids = group.map((g) => g.id).sort();
    const lat = sumLat / group.length;
    const lng = sumLng / group.length;
    out.push({
      kind: 'cluster',
      id: `c:${group.length}:${lat.toFixed(4)},${lng.toFixed(4)}:${shortHash(ids.join('|'))}`,
      lat,
      lng,
      count: group.length,
      events: group.map((g) => g.event),
    });
  }

  return out;
}

/** Camera that expands a cluster enough for member pins to un-cluster. */
export function regionFittingClusterEvents(
  events: WorkshopEventRow[],
  minDelta = 0.018
): MapClusterRegion {
  const lats = events.map((e) => Number(e.lat));
  const lngs = events.map((e) => Number(e.lng));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latitudeDelta = Math.max((maxLat - minLat) * 2.6, minDelta);
  const longitudeDelta = Math.max((maxLng - minLng) * 2.6, minDelta);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}
