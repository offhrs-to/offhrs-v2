import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { DesignColors } from '@/constants/design-template';
import HomeWorkshopCarouselCards, { type HomeCarouselEventItem } from '@/components/HomeWorkshopCarouselCards';
import { haversineKm } from '@/lib/distance';
import {
  fetchWorkshopEventsNearAnchor,
  type WorkshopEventRow,
} from '@/lib/workshops-events-query';

function formatPrice(price: number | string | null | undefined): string | null {
  if (price == null) return null;
  const s = typeof price === 'string' ? price.replace(/^\$/, '').trim() : String(price);
  if (s === '' || isNaN(Number(s))) return null;
  return `$${s}`;
}

function neighborhoodLine(loc: string | null | undefined, maxLen = 32): string | null {
  if (!loc || !loc.trim()) return null;
  const t = loc.trim();
  const comma = t.indexOf(',');
  const short = comma > 0 ? t.slice(0, comma).trim() : t;
  if (short.length <= maxLen) return short;
  return `${short.slice(0, maxLen - 1)}…`;
}

/** Closest N workshops by distance, at most one listing per vendor / partner studio. */
const CLOSEST_COUNT = 10;

function vendorKey(row: WorkshopEventRow): string {
  if (row.vendor_id != null && String(row.vendor_id).trim() !== '') {
    return `legacy:${String(row.vendor_id).trim()}`;
  }
  if (row.vendor_profile_id != null && String(row.vendor_profile_id).trim() !== '') {
    return `profile:${String(row.vendor_profile_id).trim()}`;
  }
  return `event:${row.id}`;
}

function pickFirstNUniqueVendor(sortedClosestFirst: WorkshopEventRow[], n: number): WorkshopEventRow[] {
  const seenVendor = new Set<string>();
  const out: WorkshopEventRow[] = [];
  for (const row of sortedClosestFirst) {
    const key = vendorKey(row);
    if (seenVendor.has(key)) continue;
    seenVendor.add(key);
    out.push(row);
    if (out.length >= n) break;
  }
  return out;
}

type Props = {
  userLocationAnchor: { lat: number; lng: number } | null;
  /** When true and anchor is null, show a short hint instead of hiding. */
  showHintWhenNoLocation?: boolean;
  refreshNonce?: number;
  /** Notifies parent of the current carousel IDs (for “see all” browse). */
  onItemsChange?: (items: HomeCarouselEventItem[]) => void;
};

export default function WorkshopsNearYouCarousel({
  userLocationAnchor,
  showHintWhenNoLocation = false,
  refreshNonce = 0,
  onItemsChange,
}: Props) {
  const [items, setItems] = useState<HomeCarouselEventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userLocationAnchor) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Geo bbox + pagination (not a blind global limit(500)) so nearby published
      // workshops like Dundas are not crowded out by unrelated catalog rows.
      const rows = await fetchWorkshopEventsNearAnchor(userLocationAnchor);
      const anchor = userLocationAnchor;
      const withCoords = rows.filter(
        (r) =>
          r.lat != null &&
          r.lng != null &&
          Number.isFinite(Number(r.lat)) &&
          Number.isFinite(Number(r.lng))
      );
      withCoords.sort((a, b) => {
        const da = haversineKm(anchor.lat, anchor.lng, Number(a.lat), Number(a.lng));
        const db = haversineKm(anchor.lat, anchor.lng, Number(b.lat), Number(b.lng));
        return da - db;
      });
      const picked = pickFirstNUniqueVendor(withCoords, CLOSEST_COUNT);
      const top: HomeCarouselEventItem[] = picked.map((r) => ({
        id: r.id,
        title: r.title ?? 'Workshop',
        priceLabel: formatPrice(r.price_cad ?? r.price),
        image_url: r.image_url,
        locationLine: neighborhoodLine(r.location),
        category: r.category,
      }));
      setItems(top);
    } catch (e) {
      console.warn('WorkshopsNearYouCarousel fetch', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userLocationAnchor]);

  useEffect(() => {
    onItemsChange?.(items);
  }, [items, onItemsChange]);

  useEffect(() => {
    load();
  }, [load, refreshNonce]);

  if (!userLocationAnchor) {
    if (!showHintWhenNoLocation) return null;
    return (
      <View style={{ marginTop: 4, marginBottom: 8 }}>
        <Text style={{ fontSize: 12, color: DesignColors.mediumGray, textAlign: 'left' }}>
          Save your postal code or location in Profile to see workshops near you.
        </Text>
      </View>
    );
  }

  return <HomeWorkshopCarouselCards items={items} loading={loading} />;
}
