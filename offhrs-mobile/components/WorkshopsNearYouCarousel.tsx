import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { CONSUMER_BOOKING_STATUS_OR, isEventVisibleToConsumers } from '@/lib/consumer-event-visibility';
import { supabase } from '@/lib/supabase';
import { haversineKm } from '@/lib/distance';
import { DesignColors } from '@/constants/design-template';
import HomeWorkshopCarouselCards, { type HomeCarouselEventItem } from '@/components/HomeWorkshopCarouselCards';

interface DbEventRow {
  id: number;
  title: string | null;
  date: string | null;
  location: string | null;
  image_url: string | null;
  price: number | string | null;
  category: string | null;
  recurrence: string | null;
  vendor_id: string | null;
  vendor_profile_id?: string | null;
  booking_status?: string | null;
  lat?: number | null;
  lng?: number | null;
}

function formatPrice(price: number | string | null | undefined): string | null {
  if (price == null) return null;
  const s = typeof price === 'string' ? price.replace(/^\$/, '').trim() : String(price);
  if (s === '' || isNaN(Number(s))) return null;
  return `$${s}`;
}

function isRecurring(row: { recurrence?: string | null }) {
  return row.recurrence === 'daily' || row.recurrence === 'weekly';
}

function isUpcoming(row: { date: string | null; recurrence?: string | null }, now: Date): boolean {
  if (isRecurring(row)) return true;
  if (!row.date) return false;
  return new Date(row.date).getTime() >= now.getTime();
}

function neighborhoodLine(loc: string | null | undefined, maxLen = 32): string | null {
  if (!loc || !loc.trim()) return null;
  const t = loc.trim();
  const comma = t.indexOf(',');
  const short = comma > 0 ? t.slice(0, comma).trim() : t;
  if (short.length <= maxLen) return short;
  return `${short.slice(0, maxLen - 1)}…`;
}

/** Closest N workshops by distance, at most one listing per vendor (that vendor’s nearest event wins). */
const CLOSEST_COUNT = 5;

function pickFirstNUniqueVendor(sortedClosestFirst: DbEventRow[], n: number): DbEventRow[] {
  const seenVendor = new Set<string>();
  const out: DbEventRow[] = [];
  for (const row of sortedClosestFirst) {
    const key =
      row.vendor_id != null && String(row.vendor_id).trim() !== ''
        ? String(row.vendor_id)
        : `event:${row.id}`;
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
};

export default function WorkshopsNearYouCarousel({
  userLocationAnchor,
  showHintWhenNoLocation = false,
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
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('events')
        .select(
          'id, title, date, location, image_url, price, category, recurrence, lat, lng, vendor_id, vendor_profile_id, booking_status'
        )
        .or(`recurrence.eq.daily,recurrence.eq.weekly,date.is.null,date.gte.${nowIso}`)
        .or(CONSUMER_BOOKING_STATUS_OR)
        .limit(500);
      if (error) throw error;
      const now = new Date();
      const rows = ((data ?? []) as DbEventRow[]).filter(isEventVisibleToConsumers);
      const withCoords = rows.filter(
        (r) =>
          r.lat != null &&
          r.lng != null &&
          !Number.isNaN(Number(r.lat)) &&
          !Number.isNaN(Number(r.lng)) &&
          isUpcoming(r, now)
      );
      const anchor = userLocationAnchor;
      withCoords.sort((a, b) => {
        const da = haversineKm(anchor.lat, anchor.lng, Number(a.lat), Number(a.lng));
        const db = haversineKm(anchor.lat, anchor.lng, Number(b.lat), Number(b.lng));
        return da - db;
      });
      const picked = pickFirstNUniqueVendor(withCoords, CLOSEST_COUNT);
      const top: HomeCarouselEventItem[] = picked.map((r) => ({
        id: r.id,
        title: r.title ?? 'Workshop',
        priceLabel: formatPrice(r.price),
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
    load();
  }, [load]);

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
