import { Pressable, Text, View, type StyleProp, type TextStyle } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { DesignColors } from '@/constants/design-template';

type Props = {
  title: string;
  subtitle?: string;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  /** Airbnb-style circular chevron — only shown when provided and enabled. */
  onPressSeeAll?: () => void;
  seeAllEnabled?: boolean;
  titleMarginTop?: number;
  titleMarginBottom?: number;
};

/**
 * Home carousel section title with optional “see all” chevron (Airbnb Experiences pattern).
 */
export default function HomeCarouselSectionHeader({
  title,
  subtitle,
  titleStyle,
  subtitleStyle,
  onPressSeeAll,
  seeAllEnabled = true,
  titleMarginTop,
  titleMarginBottom = 6,
}: Props) {
  const showArrow = typeof onPressSeeAll === 'function' && seeAllEnabled;

  return (
    <View style={{ alignSelf: 'stretch', marginTop: titleMarginTop }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: subtitle ? 4 : titleMarginBottom,
        }}
      >
        <Text style={[{ flex: 1 }, titleStyle]} numberOfLines={2}>
          {title}
        </Text>
        {showArrow ? (
          <Pressable
            onPress={onPressSeeAll}
            accessibilityRole="button"
            accessibilityLabel={`See all: ${title}`}
            hitSlop={8}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: DesignColors.charcoal,
              backgroundColor: '#FFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialIcons name="chevron-right" size={20} color={DesignColors.charcoal} />
          </Pressable>
        ) : null}
      </View>
      {subtitle ? (
        <Text style={[{ marginBottom: titleMarginBottom }, subtitleStyle]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}
