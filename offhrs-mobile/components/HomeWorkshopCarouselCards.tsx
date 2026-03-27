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
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import CategoryFallbackImage from '@/components/CategoryFallbackImage';
import { DesignColors } from '@/constants/design-template';

export type HomeCarouselEventItem = {
  id: number;
  title: string;
  priceLabel: string | null;
  image_url: string | null;
  locationLine: string | null;
  category?: string | null;
};

type Props = {
  items: HomeCarouselEventItem[];
  loading: boolean;
};

const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * Horizontal workshop cards for home (shared by Toronto picks and “near you” lists).
 */
export default function HomeWorkshopCarouselCards({ items, loading }: Props) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);

  const isAndroid = Platform.OS === 'android';
  const CARD_WIDTH = Math.round(SCREEN_WIDTH * (isAndroid ? 0.45 : 0.48));
  const CARD_GAP = 6;
  const PAGE = CARD_WIDTH + CARD_GAP;
  const CARD_IMAGE_HEIGHT = isAndroid ? 66 : 76;
  const CARD_FOOTER_HEIGHT = isAndroid ? 74 : 82;
  const loadingPlaceholderHeight = CARD_IMAGE_HEIGHT + CARD_FOOTER_HEIGHT + 14;

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
                <CategoryFallbackImage
                  imageUrl={item.image_url}
                  category={item.category}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  recyclingKey={`home-carousel-${item.id}`}
                />
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
                    <Text numberOfLines={1} style={{ fontSize: 10, color: DesignColors.mediumGray }}>
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
