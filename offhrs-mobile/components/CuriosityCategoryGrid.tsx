import { CATEGORIES } from '@/constants/categories';
import { DesignColors, DesignSpacing } from '@/constants/design-template';
import { getCategoryTileImageSource } from '@/lib/category-master-images';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Dimensions, Pressable, Text, View } from 'react-native';

/** Tight gap so the 2×3 category grid fits above the tab bar on common phone heights. */
const CATEGORY_GRID_GAP = 10;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_WIDTH =
  (SCREEN_WIDTH - DesignSpacing.horizontalPadding * 2 - CATEGORY_GRID_GAP) / 2;
const TILE_HEIGHT = Math.round(TILE_WIDTH * 0.74);
/** Reserved strip for category title; image sits above so artwork is not cropped by the label. */
const CATEGORY_TILE_LABEL_H = 30;
/** Match home carousel card border. */
const CATEGORY_TILE_BORDER = '#E8E8E8';

type Props = {
  /** Optional search query carried into browse when a tile is tapped. */
  searchQuery?: string;
  /** Extra top margin for the section title (e.g. after a carousel). */
  titleMarginTop?: number;
};

/**
 * “What sparks your curiosity?” photo tiles — opens workshop browse filtered by category.
 */
export default function CuriosityCategoryGrid({
  searchQuery,
  titleMarginTop = 14,
}: Props) {
  const router = useRouter();

  const pushBrowse = (category: string) => {
    const p = new URLSearchParams();
    p.set('categories', category);
    const q = searchQuery?.trim();
    if (q) p.set('q', q);
    router.push(`/workshop-browse?${p.toString()}`);
  };

  return (
    <View>
      <Text
        style={{
          fontSize: 15,
          fontWeight: '700',
          color: DesignColors.charcoal,
          marginTop: titleMarginTop,
          marginBottom: 8,
        }}
      >
        What sparks your curiosity?
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: CATEGORY_GRID_GAP,
          marginBottom: 12,
        }}
      >
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => pushBrowse(cat)}
            accessibilityRole="button"
            accessibilityLabel={`Browse ${cat} workshops`}
            style={{
              width: TILE_WIDTH,
              height: TILE_HEIGHT,
              borderRadius: 14,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: CATEGORY_TILE_BORDER,
              backgroundColor: DesignColors.creamBg,
            }}
          >
            <View
              style={{
                height: TILE_HEIGHT - CATEGORY_TILE_LABEL_H,
                width: TILE_WIDTH,
                overflow: 'hidden',
                backgroundColor: DesignColors.inputBg,
              }}
            >
              <Image
                source={getCategoryTileImageSource(cat)}
                style={{
                  width: TILE_WIDTH,
                  height: TILE_HEIGHT - CATEGORY_TILE_LABEL_H,
                }}
                contentFit="cover"
              />
            </View>
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: CATEGORY_TILE_LABEL_H,
                paddingHorizontal: 8,
                paddingVertical: 3,
                justifyContent: 'center',
                backgroundColor: DesignColors.creamBg,
                borderTopWidth: 1,
                borderTopColor: CATEGORY_TILE_BORDER,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: DesignColors.charcoal,
                  lineHeight: 12,
                }}
                numberOfLines={2}
              >
                {cat}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
