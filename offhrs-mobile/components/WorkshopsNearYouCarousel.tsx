import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
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

const CLOSEST_COUNT = 5;

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
        .select('id, title, date, location, image_url, price, category, recurrence, lat, lng')
        .or(`recurrence.eq.daily,recurrence.eq.weekly,date.is.null,date.gte.${nowIso}`)
        .limit(500);
      if (error) throw error;
      const now = new Date();
      const rows = (data ?? []) as DbEventRow[];
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
      const seen = new Set<number>();
      const top: HomeCarouselEventItem[] = [];
      for (const r of withCoords) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        top.push({
          id: r.id,
          title: r.title ?? 'Workshop',
          priceLabel: formatPrice(r.price),
          image_url: r.image_url,
          locationLine: neighborhoodLine(r.location),
          category: r.category,
        });
        if (top.length >= CLOSEST_COUNT) break;
      }
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
