import {
  View,
  Text,
  Pressable,
  FlatList,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import CategoryFallbackImage from '@/components/CategoryFallbackImage';
import { EventSaveHeartIcon } from '@/components/EventSaveHeartIcon';
import { DesignColors } from '@/constants/design-template';
import { useSavedEventIds } from '@/hooks/useSavedEventIds';
import { getHomeCarouselCardMetrics } from '@/lib/home-carousel-layout';

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

const HEART_SIZE = 28;

/**
 * Horizontal workshop cards for home (shared by Toronto picks and “near you” lists).
 * Square media; two cards fully visible with a slight peek of the next.
 * Heart save control syncs via `user_event_saves` + app-wide save events.
 */
export default function HomeWorkshopCarouselCards({ items, loading }: Props) {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { savedEventIds, toggleSave, isSaving } = useSavedEventIds();
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

  const handlePress = (id: number) => {
    // Cache-buster `t` keeps the URL distinct between consecutive taps so the
    // workshops tab re-reads search params. The workshops tab uses `openEvent`
    // only - `t` is intentionally a separate name from `openTs` (which means
    // an event occurrence ISO date) to avoid confusing the matcher.
    router.push(`/(tabs)/workshops?openEvent=${id}&t=${Date.now()}`);
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
        renderItem={({ item, index }) => {
          const saved = savedEventIds.has(item.id);
          const saving = isSaving(item.id);
          return (
            <View style={{ width: CARD_WIDTH, marginRight: index === items.length - 1 ? 0 : CARD_GAP }}>
              <View
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
                    width: CARD_WIDTH,
                    // Neutral image well — sage letterboxing clashes with white logos.
                    backgroundColor: DesignColors.inputBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Pressable
                    onPress={() => handlePress(item.id)}
                    style={styles.imagePressable}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${item.title}`}
                  >
                    <CategoryFallbackImage
                      imageUrl={item.image_url}
                      category={item.category}
                      style={styles.image}
                      contentFit="contain"
                      recyclingKey={`home-carousel-${item.id}`}
                    />
                  </Pressable>

                  {/*
                    Full-bleed overlay + flex-end — avoids NativeWind dropping StyleSheet `right`.
                    Heart sits flush on the top-right of the square image frame.
                  */}
                  <View pointerEvents="box-none" style={styles.heartOverlay}>
                    <Pressable
                      onPress={() => void toggleSave(item.id)}
                      disabled={saving}
                      accessibilityRole="button"
                      accessibilityLabel={saved ? 'Remove from saved workshops' : 'Save workshop'}
                      hitSlop={6}
                      style={({ pressed }) => [styles.heartButton, pressed ? styles.heartPressed : null]}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color={DesignColors.primary} />
                      ) : (
                        <EventSaveHeartIcon saved={saved} size={17} />
                      )}
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  onPress={() => handlePress(item.id)}
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
                      {item.title}
                    </Text>
                  </View>
                  <View style={{ height: metaLineHeight, justifyContent: 'center' }}>
                    {item.locationLine ? (
                      <Text numberOfLines={1} style={{ fontSize: 10, color: DesignColors.mediumGray }}>
                        {item.locationLine}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ height: priceLineHeight, justifyContent: 'center' }}>
                    {item.priceLabel ? (
                      <Text style={{ fontSize: 11, fontWeight: '600', color: DesignColors.charcoal }}>
                        {item.priceLabel}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 10, color: DesignColors.mediumGray }}>Price TBD</Text>
                    )}
                  </View>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  imagePressable: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  heartOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 3,
    paddingRight: 4,
    zIndex: 10,
  },
  heartButton: {
    width: HEART_SIZE,
    height: HEART_SIZE,
    borderRadius: HEART_SIZE / 2,
    marginRight: 0,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: Platform.OS === 'android' ? 6 : 0,
  },
  heartPressed: {
    opacity: 0.85,
  },
});
