/**
 * First-launch app intro: 3 full-screen slides (swipe left), logo top-left, Skip top-right.
 * Shown once per install when AsyncStorage key @offhrs/hasSeenAppIntro is not set.
 */
import { Image } from 'expo-image';
import React, { useRef } from 'react';
import {
  Dimensions,
  FlatList,
  ListRenderItem,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DesignColors,
  DesignSpacing,
  DesignSizes,
} from '@/constants/design-template';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES: { title: string; body: string }[] = [
  {
    title: 'How offhrs works',
    body: 'Sign up for an account and book workshops through the app.',
  },
  {
    title: 'Confirm your attendance',
    body: "Within 24 hours of your workshop you'll get a confirmation email. Tap the link to confirm you attended and earn points.",
  },
  {
    title: 'Earn experience points',
    body: 'You get 1 point per week of the workshop (e.g. an 8-week workshop = 8 points) and level up in that category.',
  },
];

type Props = {
  onDone: () => void;
};

export default function AppIntroScreen({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const isLastSlide = currentIndex === SLIDES.length - 1;

  const renderItem: ListRenderItem<{ title: string; body: string }> = ({
    item,
  }) => (
    <View
      style={{
        width: SCREEN_WIDTH,
        flex: 1,
        paddingHorizontal: DesignSpacing.horizontalPadding,
        paddingTop: 24,
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 24,
          fontWeight: '700',
          color: DesignColors.charcoal,
          marginBottom: 16,
        }}
      >
        {item.title}
      </Text>
      <Text
        style={{
          fontSize: 16,
          lineHeight: 24,
          color: DesignColors.mediumGray,
        }}
      >
        {item.body}
      </Text>
    </View>
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: DesignColors.creamBg,
        paddingTop: insets.top,
      }}
    >
      {/* Fixed header: logo left, Skip right */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: DesignSpacing.horizontalPadding,
          paddingVertical: 12,
          paddingLeft: DesignSpacing.horizontalPadding + DesignSpacing.logoMarginLeft,
        }}
      >
        <Image
          source={require('@/assets/images/logo.png')}
          style={{
            height: DesignSizes.logoHeight,
            width: DesignSizes.logoWidth,
          }}
          contentFit="contain"
        />
        <Pressable
          onPress={onDone}
          hitSlop={12}
          style={{ paddingVertical: 8, paddingHorizontal: 4 }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: DesignColors.primary,
            }}
          >
            Skip
          </Text>
        </Pressable>
      </View>

      {/* Horizontal paged slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        renderItem={renderItem}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => {
          const index = Math.round(
            e.nativeEvent.contentOffset.x / SCREEN_WIDTH
          );
          setCurrentIndex(index);
        }}
        style={{ flex: 1 }}
      />

      {/* Primary button: Next (advance slide) or Get started (dismiss) */}
      <View
        style={{
          paddingHorizontal: DesignSpacing.horizontalPadding,
          paddingBottom: 24 + insets.bottom,
          paddingTop: 16,
        }}
      >
        <Pressable
          onPress={() => {
            if (isLastSlide) {
              onDone();
            } else {
              const next = currentIndex + 1;
              listRef.current?.scrollToOffset({
                offset: next * SCREEN_WIDTH,
                animated: true,
              });
              setCurrentIndex(next);
            }
          }}
          style={{
            backgroundColor: DesignColors.primary,
            paddingVertical: DesignSpacing.ctaPaddingVertical,
            borderRadius: 9999,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#FFF',
            }}
          >
            {isLastSlide ? 'Get started' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
