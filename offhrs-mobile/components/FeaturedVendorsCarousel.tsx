import { View, Text, Pressable, FlatList, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import CategoryFallbackImage from '@/components/CategoryFallbackImage';
import { DesignColors } from '@/constants/design-template';
import {
  featuredVendorHref,
  fetchFeaturedVendors,
  type FeaturedVendorItem,
} from '@/lib/featured-vendors';
import { getHomeCarouselCardMetrics } from '@/lib/home-carousel-layout';

type Props = {
  userLocationAnchor?: { lat: number; lng: number } | null;
  refreshNonce?: number;
  /** Section title shown only when there is something to display (or while loading). */
  sectionTitle?: string;
  sectionTitleStyle?: object;
};

/**
 * Home “Featured” carousel — new partner studios (first 30 days), up to 10 cards.
 * Same square card sizing as Upcoming Toronto / Near you carousels.
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

  const {
    isAndroid,
    CARD_WIDTH,
    CARD_GAP,
    PAGE,
    CARD_IMAGE_HEIGHT,
    titleLineHeight,
    titleBlockHeight,
    titleToMetaGap,
    metaLineHeight,
    priceLineHeight,
    cardFooterPaddingTop,
    cardFooterPaddingBottom,
    CARD_FOOTER_HEIGHT,
    loadingPlaceholderHeight,
  } = getHomeCarouselCardMetrics(windowWidth);

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
          renderItem={({ item, index }) => (
            <View style={{ width: CARD_WIDTH, marginRight: index === items.length - 1 ? 0 : CARD_GAP }}>
              <Pressable
                onPress={() => router.push(featuredVendorHref(item) as Href)}
                style={{
                  width: CARD_WIDTH,
                  height: CARD_IMAGE_HEIGHT + CARD_FOOTER_HEIGHT,
                  borderRadius: 12,
                  backgroundColor: DesignColors.creamBg,
                  borderWidth: 1,
                  borderColor: '#E8E8E8',
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: CARD_IMAGE_HEIGHT,
                    width: '100%',
                    // Neutral image well — sage letterboxing clashes with white logos.
                    backgroundColor: DesignColors.inputBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
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
      </View>
    </View>
  );
}
