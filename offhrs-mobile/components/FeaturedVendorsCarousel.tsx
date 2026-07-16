import {
  View,
  Text,
  Pressable,
  FlatList,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import CategoryFallbackImage from '@/components/CategoryFallbackImage';
import { DesignColors, isIOSPad } from '@/constants/design-template';
import {
  featuredVendorHref,
  fetchFeaturedVendors,
  type FeaturedVendorItem,
} from '@/lib/featured-vendors';

type Props = {
  userLocationAnchor?: { lat: number; lng: number } | null;
  refreshNonce?: number;
  /** Section title shown only when there is something to display (or while loading). */
  sectionTitle?: string;
  sectionTitleStyle?: object;
};

/**
 * Home “Featured” carousel — new partner studios (first 30 days), up to 10 cards.
 * Same card sizing as Upcoming Toronto / Near you carousels.
 */
export default function FeaturedVendorsCarousel({
  userLocationAnchor = null,
  refreshNonce = 0,
  sectionTitle = 'Featured Workshop Hosts',
  sectionTitleStyle,
}: Props) {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const [items, setItems] = useState<FeaturedVendorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const isAndroid = Platform.OS === 'android';
  const isIPad = isIOSPad();
  const CARD_WIDTH = Math.round(windowWidth * (isAndroid ? 0.45 : 0.48));
  const CARD_GAP = 6;
  const PAGE = CARD_WIDTH + CARD_GAP;
  const CARD_IMAGE_HEIGHT = isAndroid ? 99 : isIPad ? 126 : 114;
  /** Tall enough for descenders (g, y) at fontSize 12 — avoids clipping next to meta. */
  const titleLineHeight = isIPad ? 20 : 17;
  const titleBlockHeight = titleLineHeight;
  const titleToMetaGap = 3;
  const metaLineHeight = 15;
  const priceLineHeight = 17;
  const cardFooterPaddingTop = 4;
  const cardFooterPaddingBottom = isAndroid ? 12 : 8;
  const CARD_FOOTER_HEIGHT =
    cardFooterPaddingTop +
    titleBlockHeight +
    titleToMetaGap +
    metaLineHeight +
    priceLineHeight +
    cardFooterPaddingBottom;
  const loadingPlaceholderHeight = CARD_IMAGE_HEIGHT + CARD_FOOTER_HEIGHT + 14;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchFeaturedVendors(userLocationAnchor);
      setItems(rows);
    } catch (e) {
      console.warn('FeaturedVendorsCarousel fetch', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userLocationAnchor]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (refreshNonce > 0) void load();
  }, [load, refreshNonce]);

  useEffect(() => {
    setActiveIndex(0);
  }, [items]);

  const syncActiveIndex = useCallback(
    (x: number) => {
      if (items.length === 0) return;
      const idx = Math.round(Math.max(0, x) / PAGE);
      setActiveIndex(Math.max(0, Math.min(idx, items.length - 1)));
    },
    [items.length, PAGE]
  );

  if (loading && items.length === 0) {
    return (
      <View>
        {sectionTitle ? (
          <Text style={[{ marginBottom: 6 }, sectionTitleStyle]}>{sectionTitle}</Text>
        ) : null}
        <View style={{ marginTop: 6, height: loadingPlaceholderHeight, justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, color: DesignColors.mediumGray, textAlign: 'center' }}>
            Loading featured studios…
          </Text>
        </View>
      </View>
    );
  }

  if (items.length === 0) return null;

  return (
    <View>
      {sectionTitle ? (
        <Text style={[{ marginBottom: 6 }, sectionTitleStyle]}>{sectionTitle}</Text>
      ) : null}
      <View style={{ marginTop: 2, marginBottom: 2 }}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.vendorProfileId}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={PAGE}
        snapToAlignment="start"
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          syncActiveIndex(e.nativeEvent.contentOffset.x);
        }}
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          syncActiveIndex(e.nativeEvent.contentOffset.x);
        }}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <View style={{ width: CARD_WIDTH, marginRight: index === items.length - 1 ? 0 : CARD_GAP }}>
            <Pressable
              onPress={() => router.push(featuredVendorHref(item) as Href)}
              style={{
                width: CARD_WIDTH,
                height: CARD_IMAGE_HEIGHT + CARD_FOOTER_HEIGHT,
                borderRadius: 10,
                backgroundColor: DesignColors.heroBg,
                overflow: 'hidden',
              }}
            >
              <View style={{ height: CARD_IMAGE_HEIGHT, width: '100%', backgroundColor: '#FFF' }}>
                <CategoryFallbackImage
                  imageUrl={item.imageUrl}
                  category={item.primaryCategory}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                  recyclingKey={`featured-vendor-${item.vendorProfileId}`}
                />
              </View>
              <View
                style={{
                  height: CARD_FOOTER_HEIGHT,
                  paddingHorizontal: 8,
                  paddingTop: cardFooterPaddingTop,
                  paddingBottom: cardFooterPaddingBottom,
                }}
              >
                <View
                  style={{
                    height: titleBlockHeight,
                    overflow: 'hidden',
                    justifyContent: 'center',
                    marginBottom: titleToMetaGap,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      fontSize: 12,
                      lineHeight: titleLineHeight,
                      fontWeight: '700',
                      color: DesignColors.charcoal,
                      ...(isAndroid ? { includeFontPadding: false } : null),
                    }}
                  >
                    {item.businessName}
                  </Text>
                </View>
                <View style={{ height: metaLineHeight, justifyContent: 'center' }}>
                  {item.distanceKm != null ? (
                    <Text numberOfLines={1} style={{ fontSize: 10, color: DesignColors.mediumGray }}>
                      {item.distanceKm} km
                    </Text>
                  ) : null}
                </View>
                <View style={{ height: priceLineHeight, justifyContent: 'center' }}>
                  {item.categoriesLine ? (
                    <Text numberOfLines={1} style={{ fontSize: 10, color: DesignColors.mediumGray }}>
                      {item.categoriesLine}
                    </Text>
                  ) : null}
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
    </View>
  );
}
