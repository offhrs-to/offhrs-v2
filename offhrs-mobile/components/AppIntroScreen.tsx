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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Usable content height = screen minus fixed header (~80px) and footer (~80px). */
const IMAGE_AREA_HEIGHT = Math.round(SCREEN_HEIGHT * 0.38);

const LEVEL_DATA: { label: string; source: number }[] = [
  { label: 'Novice',       source: require('@/assets/images/other-novice.png') },
  { label: 'Intermediate', source: require('@/assets/images/other-intermediate.png') },
  { label: 'Advanced',     source: require('@/assets/images/other-advanced.png') },
  { label: 'Expert',       source: require('@/assets/images/other-expert.png') },
  { label: 'Master',       source: require('@/assets/images/other-master.png') },
];

/** Icon sizes grow from smallest (Novice) to largest (Master). */
const LEVEL_ICON_SIZES = [28, 36, 44, 52, 60];

/** Extra bottom margin lifts each icon up to form a rising staircase (left = low, right = high). */
const LEVEL_STEP_HEIGHTS = [0, 14, 28, 44, 62];

function Slide0() {
  return (
    <View style={{ width: SCREEN_WIDTH, flex: 1, alignItems: 'center', paddingHorizontal: DesignSpacing.horizontalPadding }}>
      {/* Clock image */}
      <View
        style={{
          height: IMAGE_AREA_HEIGHT,
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Image
          source={require('@/assets/images/intro-clock.png')}
          style={{ width: SCREEN_WIDTH * 0.72, height: IMAGE_AREA_HEIGHT * 0.9 }}
          contentFit="contain"
        />
      </View>

      {/* Text */}
      <Text style={styles.heading}>Welcome to offhrs</Text>
      <Text style={styles.body}>
        Sign up for an account and book your first workshop through the app.
      </Text>
    </View>
  );
}

function Slide1() {
  return (
    <View style={{ width: SCREEN_WIDTH, flex: 1, alignItems: 'center', paddingHorizontal: DesignSpacing.horizontalPadding }}>
      {/* Phone / verify image */}
      <View
        style={{
          height: IMAGE_AREA_HEIGHT,
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Image
          source={require('@/assets/images/intro-phone.png')}
          style={{ width: SCREEN_WIDTH * 0.62, height: IMAGE_AREA_HEIGHT * 0.9 }}
          contentFit="contain"
        />
      </View>

      {/* Text */}
      <Text style={styles.heading}>Confirm your attendance</Text>
      <Text style={styles.body}>
        Within 24 hours of your workshop, you'll get a confirmation email. Tap the link to confirm you attended and earn points.
      </Text>
    </View>
  );
}

function Slide2() {
  return (
    <View style={{ width: SCREEN_WIDTH, flex: 1, alignItems: 'center', paddingHorizontal: DesignSpacing.horizontalPadding }}>
      {/* Staircase progression */}
      <View
        style={{
          height: IMAGE_AREA_HEIGHT,
          width: '100%',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: 8,
        }}
      >
        {/* Rising staircase row */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6 }}>
          {LEVEL_DATA.map((lvl, i) => {
            const size = LEVEL_ICON_SIZES[i]!;
            const lift = LEVEL_STEP_HEIGHTS[i]!;
            return (
              <View
                key={lvl.label}
                style={{
                  alignItems: 'center',
                  marginBottom: lift,
                  width: 58,
                }}
              >
                <Image
                  source={lvl.source}
                  style={{ width: size, height: size }}
                  contentFit="contain"
                />
                <Text
                  style={{
                    fontSize: 9,
                    marginTop: 4,
                    textAlign: 'center',
                    fontWeight: i === 4 ? '700' : '400',
                    color: i === 4 ? DesignColors.primary : DesignColors.mediumGray,
                  }}
                  numberOfLines={1}
                >
                  {lvl.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Thin connecting baseline */}
        <View
          style={{
            position: 'absolute',
            bottom: 8,
            left: DesignSpacing.horizontalPadding * 0.5,
            right: DesignSpacing.horizontalPadding * 0.5,
            height: 1.5,
            backgroundColor: DesignColors.lightGreenBorder,
            borderRadius: 1,
          }}
        />
      </View>

      {/* Text */}
      <Text style={styles.heading}>Cultivate your craft</Text>

      <Text style={[styles.body, { marginBottom: 4 }]}>Get 1 point per workshop</Text>

      <View style={{ width: '100%', gap: 6, marginTop: 2 }}>
        {[
          'Track your progress',
          'Level up to become a Master in your category of interest',
          'Ex. An 8-week workshop = 8 points!',
        ].map((line) => (
          <View key={line} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Text style={{ fontSize: 13, color: DesignColors.primary, lineHeight: 20, marginTop: 1 }}>•</Text>
            <Text style={{ flex: 1, fontSize: 13, lineHeight: 20, color: DesignColors.mediumGray }}>{line}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const SLIDE_COMPONENTS = [Slide0, Slide1, Slide2];

const styles = {
  heading: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    color: DesignColors.charcoal,
    textAlign: 'center' as const,
    marginTop: 20,
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: DesignColors.mediumGray,
    textAlign: 'center' as const,
  },
};

type Props = {
  onDone: () => void;
};

export default function AppIntroScreen({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const isLastSlide = currentIndex === SLIDE_COMPONENTS.length - 1;

  const renderItem: ListRenderItem<typeof SLIDE_COMPONENTS[number]> = ({ item: SlideComponent }) => (
    <SlideComponent />
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

      {/* Dot indicators */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
        {SLIDE_COMPONENTS.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === currentIndex ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === currentIndex ? DesignColors.primary : DesignColors.lightGreenBorder,
            }}
          />
        ))}
      </View>

      {/* Horizontal paged slides */}
      <FlatList
        ref={listRef}
        data={SLIDE_COMPONENTS}
        renderItem={renderItem}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
        }}
        style={{ flex: 1 }}
      />

      {/* Primary button: Next or Get started */}
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
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFF' }}>
            {isLastSlide ? 'Get started' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
