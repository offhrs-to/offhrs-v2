import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import HomeWorkshopCarouselCards, { type HomeCarouselEventItem } from '@/components/HomeWorkshopCarouselCards';
import { haversineKm } from '@/lib/distance';
import { pickFirstNUniqueCategory } from '@/lib/home-carousel-events';
import { CONSUMER_BOOKING_STATUS_OR, isEventVisibleToConsumers } from '@/lib/consumer-event-visibility';
import { supabase } from '@/lib/supabase';

const FETCH_LIMIT = 500;

interface DbEventRow {
  id: number;
  title: string | null;
  date: string | null;
  location: string | null;
  image_url: string | null;
  price: number | string | null;
  category: string | null;
  recurrence: string | null;
  vendor_profile_id?: string | null;
  booking_status?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export type CarouselEventItem = HomeCarouselEventItem;

function formatPrice(price: number | string | null | undefined): string | null {
  if (price == null) return null;
  const s = typeof price === 'string' ? price.replace(/^\$/, '').trim() : String(price);
  if (s === '' || isNaN(Number(s))) return null;
  return `$${s}`;
}

function isTorontoAreaLocation(loc: string | null | undefined): boolean {
  if (!loc || !loc.trim()) return false;
  const l = loc.toLowerCase();
  const keys = [
    'toronto',
    'gta',
    'etobicoke',
    'scarborough',
    'north york',
    'east york',
    'yorkville',
    'queen west',
    'king west',
    'liberty village',
    'mississauga',
    'markham',
    'vaughan',
    'richmond hill',
    'oakville',
    'pickering',
  ];
  return keys.some((k) => l.includes(k));
}

function isRecurring(row: { recurrence?: string | null }) {
  return row.recurrence === 'daily' || row.recurrence === 'weekly';
}

function isUpcoming(row: { date: string | null; recurrence?: string | null }, now: Date): boolean {
  if (isRecurring(row)) return true;
  if (!row.date) return false;
  return new Date(row.date).getTime() >= now.getTime();
}

/** Sort key: soonest wall-clock start; recurring rows treated as “now” so they sit with imminently relevant listings. */
function nextStartMs(row: DbEventRow, nowMs: number): number {
  if (isRecurring(row)) return nowMs;
  if (!row.date) return Number.POSITIVE_INFINITY;
  return new Date(row.date).getTime();
}

function neighborhoodLine(loc: string | null | undefined, maxLen = 32): string | null {
  if (!loc || !loc.trim()) return null;
  const t = loc.trim();
  const comma = t.indexOf(',');
  const short = comma > 0 ? t.slice(0, comma).trim() : t;
  if (short.length <= maxLen) return short;
  return `${short.slice(0, maxLen - 1)}…`;
}

function distanceToAnchor(r: DbEventRow, anchor: { lat: number; lng: number }): number {
  if (r.lat == null || r.lng == null) return Number.POSITIVE_INFINITY;
  return haversineKm(anchor.lat, anchor.lng, Number(r.lat), Number(r.lng));
}

const CAROUSEL_COUNT = 10;

/**
 * Up to 10 upcoming events, each from a different category when possible.
 * GTA/Toronto-area rows are considered first (soonest start, then distance to anchor); then other upcoming rows.
 */
function pickNextFiveToronto(
  rows: DbEventRow[],
  anchor: { lat: number; lng: number } | null
): HomeCarouselEventItem[] {
  const now = new Date();
  const nowMs = now.getTime();
  const upcoming = rows.filter((r) => isUpcoming(r, now));
  if (upcoming.length === 0) return [];

  const byTimeThenDistance = (a: DbEventRow, b: DbEventRow) => {
    const diff = nextStartMs(a, nowMs) - nextStartMs(b, nowMs);
    if (diff !== 0) return diff;
    if (anchor) {
      const da = distanceToAnchor(a, anchor);
      const db = distanceToAnchor(b, anchor);
      if (Math.abs(da - db) > 1e-9) return da - db;
    }
    return a.id - b.id;
  };

  const inArea = upcoming.filter((r) => isTorontoAreaLocation(r.location));
  const outOfArea = upcoming.filter((r) => !isTorontoAreaLocation(r.location));
  const ordered = [...[...inArea].sort(byTimeThenDistance), ...[...outOfArea].sort(byTimeThenDistance)];
  const picked = pickFirstNUniqueCategory(ordered, CAROUSEL_COUNT);
  picked.sort(byTimeThenDistance);

  return picked.map((best) => ({
    id: best.id,
    title: best.title ?? 'Workshop',
    priceLabel: formatPrice(best.price),
    image_url: best.image_url,
    locationLine: neighborhoodLine(best.location),
    category: best.category,
  }));
}

type Props = {
  horizontalPadding?: number;
  userLocationAnchor?: { lat: number; lng: number } | null;
  refreshNonce?: number;
  /** Notifies parent of the current carousel IDs (for “see all” browse). */
  onItemsChange?: (items: HomeCarouselEventItem[]) => void;
};

export default function UpcomingTorontoCarousel({
  userLocationAnchor = null,
  refreshNonce = 0,
  onItemsChange,
}: Props) {
  const [items, setItems] = useState<HomeCarouselEventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('events')
        .select(
          'id, title, date, location, image_url, price, category, recurrence, lat, lng, vendor_profile_id, booking_status'
        )
        .or(`recurrence.eq.daily,recurrence.eq.weekly,date.is.null,date.gte.${nowIso}`)
        .or(CONSUMER_BOOKING_STATUS_OR)
        .order('date', { ascending: true })
        .limit(FETCH_LIMIT);
      if (error) throw error;
      const visible = ((data ?? []) as DbEventRow[]).filter(isEventVisibleToConsumers);
      const picked = pickNextFiveToronto(visible, userLocationAnchor ?? null);
      setItems(picked);
    } catch (e) {
      console.warn('UpcomingTorontoCarousel fetch', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userLocationAnchor]);

  useEffect(() => {
    onItemsChange?.(items);
  }, [items, onItemsChange]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (refreshNonce > 0) void load();
  }, [load, refreshNonce]);

  return <HomeWorkshopCarouselCards items={items} loading={loading} />;
}
