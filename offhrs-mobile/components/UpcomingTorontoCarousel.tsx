import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Dimensions,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { DesignColors } from '@/constants/design-template';

/** One upcoming pick per category; Toronto-area locations preferred. */
const TARGET_CATEGORIES = ['Beauty & Fragrance', 'Coffee', 'Pottery', 'Culinary', 'Floral'] as const;

interface DbEventRow {
  id: number;
  title: string | null;
  date: string | null;
  location: string | null;
  image_url: string | null;
  price: number | string | null;
  category: string | null;
  recurrence: string | null;
}

export interface CarouselEventItem {
  id: number;
  title: string;
  priceLabel: string | null;
  image_url: string | null;
  locationLine: string | null;
}

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

function sortTime(row: { date: string | null; recurrence?: string | null }, nowMs: number): number {
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

function pickCarouselEvents(rows: DbEventRow[]): CarouselEventItem[] {
  const now = new Date();
  const nowMs = now.getTime();
  const upcoming = rows.filter(
    (r) =>
      r.category != null &&
      (TARGET_CATEGORIES as readonly string[]).includes(r.category) &&
      isUpcoming(r, now)
  );
  const out: CarouselEventItem[] = [];
  for (const cat of TARGET_CATEGORIES) {
    const inCat = upcoming.filter((r) => r.category === cat);
    const toronto = inCat.filter((r) => isTorontoAreaLocation(r.location));
    const choices = toronto.length > 0 ? toronto : inCat;
    choices.sort((a, b) => sortTime(a, nowMs) - sortTime(b, nowMs));
    const best = choices[0];
    if (!best) continue;
    out.push({
      id: best.id,
      title: best.title ?? 'Workshop',
      priceLabel: formatPrice(best.price),
      image_url: best.image_url,
      locationLine: neighborhoodLine(best.location),
    });
  }
  return out;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

type Props = {
  /** Inset before first / after last card. Use 0 when the parent already applies horizontal padding (e.g. home ScrollView). */
  horizontalPadding?: number;
};

export default function UpcomingTorontoCarousel({ horizontalPadding = 0 }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<CarouselEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const isAndroid = Platform.OS === 'android';
  const CARD_WIDTH = Math.round(SCREEN_WIDTH * (isAndroid ? 0.45 : 0.48));
  const CARD_GAP = 6;
  const PAGE = CARD_WIDTH + CARD_GAP;
  /** Fixed image + footer heights so every carousel card is the same size. */
  const CARD_IMAGE_HEIGHT = isAndroid ? 66 : 76;
  const CARD_FOOTER_HEIGHT = isAndroid ? 74 : 82;
  const loadingPlaceholderHeight = CARD_IMAGE_HEIGHT + CARD_FOOTER_HEIGHT + 14;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, date, location, image_url, price, category, recurrence')
        .in('category', [...TARGET_CATEGORIES])
        .order('date', { ascending: true });
      if (error) throw error;
      const picked = pickCarouselEvents((data ?? []) as DbEventRow[]);
      setItems(picked);
    } catch (e) {
      console.warn('UpcomingTorontoCarousel fetch', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const syncActiveIndex = (x: number) => {
    if (items.length === 0) return;
    const idx = Math.round(Math.max(0, x) / PAGE);
    setActiveIndex(Math.max(0, Math.min(idx, items.length - 1)));
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    syncActiveIndex(e.nativeEvent.contentOffset.x);
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    syncActiveIndex(e.nativeEvent.contentOffset.x);
  };

  const handlePress = (id: number) => {
    router.push(`/(tabs)/workshops?openEvent=${id}&openTs=${Date.now()}`);
  };

  if (loading && items.length === 0) {
    return (
      <View style={{ marginTop: 6, height: loadingPlaceholderHeight, justifyContent: 'center' }}>
        <Text style={{ fontSize: 12, color: DesignColors.mediumGray, textAlign: 'center' }}>
          Loading workshops…
        </Text>
      </View>
    );
  }

  if (items.length === 0) return null;

  return (
    <View style={{ marginTop: 2, marginBottom: 2 }}>
      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={PAGE}
        snapToAlignment="start"
        ListHeaderComponent={
          horizontalPadding > 0 ? <View style={{ width: horizontalPadding }} /> : undefined
        }
        ListFooterComponent={
          horizontalPadding > 0 ? <View style={{ width: horizontalPadding }} /> : undefined
        }
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <View style={{ width: CARD_WIDTH, marginRight: index === items.length - 1 ? 0 : CARD_GAP }}>
            <Pressable
              onPress={() => handlePress(item.id)}
              style={{
                width: CARD_WIDTH,
                minHeight: CARD_IMAGE_HEIGHT + CARD_FOOTER_HEIGHT,
                borderRadius: 10,
                backgroundColor: DesignColors.heroBg,
                overflow: 'hidden',
              }}
            >
              <View style={{ height: CARD_IMAGE_HEIGHT, width: '100%', backgroundColor: DesignColors.inputBg }}>
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10, color: DesignColors.mediumGray }}>No image</Text>
                  </View>
                )}
              </View>
              <View
                style={{
                  height: CARD_FOOTER_HEIGHT,
                  paddingHorizontal: 8,
                  paddingTop: 6,
                  paddingBottom: 10,
                }}
              >
                <View style={{ height: 30, justifyContent: 'flex-start' }}>
                  <Text
                    numberOfLines={2}
                    style={{
                      fontSize: 12,
                      lineHeight: 15,
                      fontWeight: '700',
                      color: DesignColors.charcoal,
                    }}
                  >
                    {item.title}
                  </Text>
                </View>
                <View style={{ height: 16, marginTop: 1, justifyContent: 'center' }}>
                  {item.locationLine ? (
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 10, color: DesignColors.mediumGray }}
                    >
                      {item.locationLine}
                    </Text>
                  ) : null}
                </View>
                <View style={{ height: 18, marginTop: 1, justifyContent: 'center' }}>
                  {item.priceLabel ? (
                    <Text style={{ fontSize: 11, fontWeight: '600', color: DesignColors.charcoal }}>
                      {item.priceLabel}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 10, color: DesignColors.mediumGray }}>Price TBD</Text>
                  )}
                </View>
              </View>
            </Pressable>
          </View>
        )}
      />
      {items.length > 1 ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 4,
            marginTop: 6,
          }}
        >
          {items.map((_, i) => (
            <View
              key={i}
              style={{
                width: 5,
                height: 5,
                borderRadius: 2.5,
                backgroundColor: i === activeIndex ? DesignColors.charcoal : '#CFCFCF',
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
