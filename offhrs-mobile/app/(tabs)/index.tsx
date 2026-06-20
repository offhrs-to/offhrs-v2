import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DeviceEventEmitter,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { UserCircleIcon } from 'react-native-heroicons/outline';

import InstructorIcon from '@/components/InstructorIcon';
import UpcomingTorontoCarousel from '@/components/UpcomingTorontoCarousel';
import WorkshopsNearYouCarousel from '@/components/WorkshopsNearYouCarousel';
import { CATEGORIES } from '@/constants/categories';
import { DesignColors, DesignSizes, DesignSpacing, isIOSPad } from '@/constants/design-template';
import { useAuth } from '@/contexts/AuthContext';
import { PROFILE_UPDATED_EVENT } from '@/lib/profile-events';
import { supabase } from '@/lib/supabase';

const CREAM_BG = '#FDFCF8';
/** Display serif for hero headline (elegant, close to reference). */
const HERO_SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
const CHARCOAL = '#2C2C2C';
const MEDIUM_GRAY = '#6B6B6B';

const HORIZONTAL_PADDING = 24;

const isAndroid = Platform.OS === 'android';
const AVATAR_SIZE = isAndroid ? 46 : 52;
/** Space below header divider before hero — keep small so headline sits close to grey line. */
const SCROLL_PADDING_TOP = isAndroid ? 4 : 6;
/** Scroll padding below content — room above floating tab bar. */
const SCROLL_PADDING_BOTTOM = isAndroid ? 76 : 28;
const HERO_HEADLINE_FONT_SIZE = isAndroid ? 30 : 34;
const HERO_HEADLINE_LINE_HEIGHT = isAndroid ? 38 : 42;
const ICON_BAR_HEIGHT = isAndroid ? 48 : 56;
const ICON_CIRCLE_SIZE = isAndroid ? 40 : 44;
const SECTION_TITLE_FONT_SIZE = isAndroid ? 14 : 15;
const SECTION_SUBTITLE_FONT_SIZE = isAndroid ? 12 : 13;
const CAROUSEL_SECTION_GAP = isAndroid ? 10 : 12;

// Each level is 8 points; progression shown as X/8 for all levels (Novice → Master)
const LEVEL_THRESHOLDS: Record<string, { start: number; step: number }> = {
  Novice: { start: 0, step: 8 },
  Intermediate: { start: 8, step: 8 },
  Advanced: { start: 16, step: 8 },
  Expert: { start: 24, step: 8 },
  Master: { start: 32, step: 0 },
};

function getLevelProgress(level: string, points: number): { progress: number; label: string } {
  const config = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS.Novice;
  if (config.step === 0) return { progress: 1, label: 'Max' };
  const currentInSegment = Math.max(0, points - config.start);
  const progress = Math.min(1, currentInSegment / config.step);
  const label = `${Math.min(currentInSegment, config.step)}/${config.step}`;
  return { progress, label };
}

// Floral category uses bespoke icons per level (Novice → Master)
const FLORAL_ICONS: Record<string, any> = {
  Novice: require('@/assets/images/floral-novice.png'),
  Intermediate: require('@/assets/images/floral-intermediate.png'),
  Advanced: require('@/assets/images/floral-advanced.png'),
  Expert: require('@/assets/images/floral-expert.png'),
  Master: require('@/assets/images/floral-master.png'),
};

const getFloralIconSource = (level: string) =>
  FLORAL_ICONS[level] ?? FLORAL_ICONS.Novice;

// Culinary category uses bespoke icons per level (Novice → Master)
const CULINARY_ICONS: Record<string, any> = {
  Novice: require('@/assets/images/culinary-novice.png'),
  Intermediate: require('@/assets/images/culinary-intermediate.png'),
  Advanced: require('@/assets/images/culinary-advanced.png'),
  Expert: require('@/assets/images/culinary-expert.png'),
  Master: require('@/assets/images/culinary-master.png'),
};

const getCulinaryIconSource = (level: string) =>
  CULINARY_ICONS[level] ?? CULINARY_ICONS.Novice;

// Pottery category uses bespoke icons per level (Novice → Master)
const POTTERY_ICONS: Record<string, any> = {
  Novice: require('@/assets/images/pottery-novice.png'),
  Intermediate: require('@/assets/images/pottery-intermediate.png'),
  Advanced: require('@/assets/images/pottery-advanced.png'),
  Expert: require('@/assets/images/pottery-expert.png'),
  Master: require('@/assets/images/pottery-master.png'),
};

const getPotteryIconSource = (level: string) =>
  POTTERY_ICONS[level] ?? POTTERY_ICONS.Novice;

// Coffee category uses bespoke icons per level (Novice → Master)
const COFFEE_ICONS: Record<string, any> = {
  Novice: require('@/assets/images/coffee-novice.png'),
  Intermediate: require('@/assets/images/coffee-intermediate.png'),
  Advanced: require('@/assets/images/coffee-advanced.png'),
  Expert: require('@/assets/images/coffee-expert.png'),
  Master: require('@/assets/images/coffee-master.png'),
};

const getCoffeeIconSource = (level: string) =>
  COFFEE_ICONS[level] ?? COFFEE_ICONS.Novice;

// Beauty & Fragrance category uses bespoke icons per level (Novice → Master)
const BEAUTY_FRAGRANCE_ICONS: Record<string, any> = {
  Novice: require('@/assets/images/beauty-fragrance-novice.png'),
  Intermediate: require('@/assets/images/beauty-fragrance-intermediate.png'),
  Advanced: require('@/assets/images/beauty-fragrance-advanced.png'),
  Expert: require('@/assets/images/beauty-fragrance-expert.png'),
  Master: require('@/assets/images/beauty-fragrance-master.png'),
};

const getBeautyFragranceIconSource = (level: string) =>
  BEAUTY_FRAGRANCE_ICONS[level] ?? BEAUTY_FRAGRANCE_ICONS.Novice;

// Other category uses bespoke icons per level (Novice → Master)
const OTHER_ICONS: Record<string, any> = {
  Novice: require('@/assets/images/other-novice.png'),
  Intermediate: require('@/assets/images/other-intermediate.png'),
  Advanced: require('@/assets/images/other-advanced.png'),
  Expert: require('@/assets/images/other-expert.png'),
  Master: require('@/assets/images/other-master.png'),
};

const getOtherIconSource = (level: string) =>
  OTHER_ICONS[level] ?? OTHER_ICONS.Novice;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const isIPad = isIOSPad();
  const headerPaddingTop = isIPad
    ? Math.max(insets.top, 20) + 12
    : DesignSpacing.contentPaddingTop;
  const logoMarginLeft = isIPad ? 0 : DesignSpacing.logoMarginLeft;
  const homeScrollPaddingBottom = isIPad ? Math.max(SCROLL_PADDING_BOTTOM, insets.bottom + 72) : SCROLL_PADDING_BOTTOM;

  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<{
    display_name: string | null;
    avatar_url: string | null;
    expertise_level: string | null;
    experience_points: number | null;
    instructor_categories: string[] | null;
    onboarding_completed: boolean | null;
    location_lat: number | null;
    location_lng: number | null;
  } | null>(null);
  const [categoryExperience, setCategoryExperience] = useState<Record<string, { level: string; points: number }>>({});
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [popupCategory, setPopupCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [homeRefreshNonce, setHomeRefreshNonce] = useState(0);

  const levelCategories = CATEGORIES;
  const instructorCategories = profile?.instructor_categories ?? [];

  useEffect(() => {
    if (!user?.id) {
      setProfileLoaded(!!user);
      return;
    }
    Promise.all([
      supabase
        .from('profiles')
        .select(
          'display_name, avatar_url, expertise_level, experience_points, instructor_categories, onboarding_completed, location_lat, location_lng'
        )
        .eq('id', user.id)
        .single()
        .then(({ data }) => data ?? null),
      supabase
        .from('profile_category_experience')
        .select('category, expertise_level, experience_points')
        .eq('user_id', user.id)
        .then(({ data }) => {
          const map: Record<string, { level: string; points: number }> = {};
          (data ?? []).forEach((row) => {
            map[row.category] = { level: row.expertise_level ?? 'Novice', points: row.experience_points ?? 0 };
          });
          return map;
        }),
    ]).then(([profileData, catMap]) => {
      setProfile(profileData);
      setCategoryExperience(catMap ?? {});
      setProfileLoaded(true);
    });
  }, [user?.id]);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await Promise.all([
      supabase
        .from('profiles')
        .select(
          'display_name, avatar_url, expertise_level, experience_points, instructor_categories, onboarding_completed, location_lat, location_lng'
        )
        .eq('id', user.id)
        .single()
        .then(({ data }) => setProfile(data ?? null)),
      supabase
        .from('profile_category_experience')
        .select('category, expertise_level, experience_points')
        .eq('user_id', user.id)
        .then(({ data }) => {
          const map: Record<string, { level: string; points: number }> = {};
          (data ?? []).forEach((row) => {
            map[row.category] = { level: row.expertise_level ?? 'Novice', points: row.experience_points ?? 0 };
          });
          setCategoryExperience(map);
        }),
    ]);
  }, [user?.id]);

  const handleAndroidRefresh = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    setRefreshing(true);
    try {
      await refreshProfile();
      setHomeRefreshNonce((n) => n + 1);
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile]);

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
    }, [refreshProfile])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(PROFILE_UPDATED_EVENT, () => {
      refreshProfile();
    });
    return () => sub.remove();
  }, [refreshProfile]);

  const carouselLocationAnchor = useMemo(() => {
    if (profile?.location_lat == null || profile?.location_lng == null) return null;
    return { lat: Number(profile.location_lat), lng: Number(profile.location_lng) };
  }, [profile?.location_lat, profile?.location_lng]);

  const displayName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    String(user?.email ?? '').split('@')[0] ||
    'Guest';
  // Avatar: profile (synced from OAuth), then auth user_metadata (Google: avatar_url or picture)
  const avatarUrl =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null;
  const isInstructorForCategory = (cat: string) => instructorCategories.includes(cat);
  const getLevelForCategory = (cat: string) => {
    if (isInstructorForCategory(cat)) return { level: 'Instructor', points: 0 };
    const ce = categoryExperience[cat];
    return ce ? { level: ce.level, points: ce.points } : { level: 'Novice', points: 0 };
  };

  return (
    <View style={{ flex: 1, backgroundColor: CREAM_BG }}>
      {/* Fixed header: logo + welcome row (stays in place when scrolling) */}
      <View
        style={{
          paddingTop: headerPaddingTop,
          paddingBottom: DesignSpacing.logoHeaderPaddingBottom,
          paddingHorizontal: DesignSpacing.horizontalPadding,
          backgroundColor: CREAM_BG,
          borderBottomWidth: 1,
          borderBottomColor: '#E5E5E5',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: isAndroid ? 10 : 12,
          }}
        >
          <View style={{ marginLeft: logoMarginLeft, paddingLeft: 0, flexShrink: 0 }}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={{ height: DesignSizes.logoHeight, width: DesignSizes.logoWidth }}
              contentFit="contain"
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flex: 1,
              justifyContent: 'flex-end',
              minWidth: 0,
              marginLeft: 8,
            }}
          >
            <View style={{ marginRight: 10, alignItems: 'flex-end', flexShrink: 1, minWidth: 0 }}>
              <Text className="text-xs" style={{ color: MEDIUM_GRAY }}>
                Welcome
              </Text>
              <Text
                className="text-xl font-bold"
                style={{ color: CHARCOAL }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {displayName}
              </Text>
            </View>
            <View
              style={{
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                borderRadius: AVATAR_SIZE / 2,
                backgroundColor: avatarUrl ? 'transparent' : '#E0E0E0',
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                  contentFit="cover"
                />
              ) : (
                <UserCircleIcon size={isAndroid ? 32 : 36} color={MEDIUM_GRAY} />
              )}
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: SCROLL_PADDING_TOP,
          paddingBottom: homeScrollPaddingBottom,
          paddingHorizontal: HORIZONTAL_PADDING,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          Platform.OS === 'android' ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleAndroidRefresh}
              tintColor={DesignColors.primary}
              colors={[DesignColors.primary]}
              progressBackgroundColor={CREAM_BG}
            />
          ) : undefined
        }
      >
      <Text
        style={{
          fontFamily: HERO_SERIF_FONT,
          fontSize: HERO_HEADLINE_FONT_SIZE,
          lineHeight: isIPad ? HERO_HEADLINE_LINE_HEIGHT + 8 : HERO_HEADLINE_LINE_HEIGHT,
          color: CHARCOAL,
          textAlign: 'left',
          fontWeight: '400',
          marginTop: isAndroid ? 2 : 4,
          marginBottom: isIPad ? 20 : isAndroid ? 12 : 16,
        }}
      >
        Discover your new passion
      </Text>

      <Text
        style={{
          color: CHARCOAL,
          fontSize: SECTION_TITLE_FONT_SIZE,
          fontWeight: '700',
          textAlign: 'left',
          alignSelf: 'stretch',
          marginBottom: isIPad ? 10 : isAndroid ? 6 : 8,
        }}
      >
        Your mastery progression
      </Text>

      {/* Level icons bar: categories use level-specific icons (Novice → Master).
          - Instructor categories show graduation cap icon and "Instructor" (no progression) in popup. */}
      <View
        style={{
          marginBottom: isIPad ? 14 : isAndroid ? 10 : 12,
          height: isIPad ? ICON_BAR_HEIGHT + 8 : ICON_BAR_HEIGHT,
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'space-evenly',
          alignItems: 'center',
        }}
      >
        {levelCategories.map((cat) => {
          const isInstructor = isInstructorForCategory(cat);
          const catLevel = getLevelForCategory(cat).level;
          const circleSize = ICON_CIRCLE_SIZE;
          return (
            <Pressable
              key={cat}
              onPress={() => setPopupCategory(cat)}
              style={{
                width: circleSize,
                height: circleSize,
                borderRadius: circleSize / 2,
                borderWidth: 2,
                borderColor: DesignColors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {isInstructor ? (
                <InstructorIcon size={isAndroid ? 18 : 20} color={DesignColors.primary} />
              ) : cat === 'Floral' ? (
                <View style={{ width: circleSize, height: circleSize, borderRadius: circleSize / 2, overflow: 'hidden' }}>
                  <Image
                    source={getFloralIconSource(catLevel)}
                    style={{ width: circleSize + 14, height: circleSize + 14, position: 'absolute', left: -7, top: -7 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Culinary' ? (
                <View style={{ width: circleSize, height: circleSize, borderRadius: circleSize / 2, overflow: 'hidden' }}>
                  <Image
                    source={getCulinaryIconSource(catLevel)}
                    style={{ width: circleSize + 12, height: circleSize + 12, position: 'absolute', left: -6, top: -6 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Pottery' ? (
                <View style={{ width: circleSize, height: circleSize, borderRadius: circleSize / 2, overflow: 'hidden' }}>
                  <Image
                    source={getPotteryIconSource(catLevel)}
                    style={{ width: circleSize + 22, height: circleSize + 22, position: 'absolute', left: -11, top: -11 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Coffee' ? (
                <View style={{ width: circleSize, height: circleSize, borderRadius: circleSize / 2, overflow: 'hidden' }}>
                  <Image
                    source={getCoffeeIconSource(catLevel)}
                    style={{ width: circleSize + 12, height: circleSize + 12, position: 'absolute', left: -6, top: -6 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Beauty & Fragrance' ? (
                <View style={{ width: circleSize, height: circleSize, borderRadius: circleSize / 2, overflow: 'hidden' }}>
                  <Image
                    source={getBeautyFragranceIconSource(catLevel)}
                    style={{ width: circleSize + 18, height: circleSize + 18, position: 'absolute', left: -9, top: -9 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Other' ? (
                <Image
                  source={getOtherIconSource(catLevel)}
                  style={{ width: isAndroid ? 28 : 32, height: isAndroid ? 28 : 32 }}
                  contentFit="contain"
                />
              ) : (
                <MaterialIcons name="star" size={isAndroid ? 18 : 20} color={DesignColors.primary} />
              )}
            </Pressable>
          );
        })}
      </View>

      <Text
        style={{
          color: CHARCOAL,
          fontSize: SECTION_TITLE_FONT_SIZE,
          fontWeight: '700',
          textAlign: 'left',
          alignSelf: 'stretch',
          marginBottom: 6,
        }}
      >
        Upcoming workshops in Toronto
      </Text>
      <UpcomingTorontoCarousel
        userLocationAnchor={carouselLocationAnchor}
        refreshNonce={homeRefreshNonce}
      />

      <Text
        style={{
          color: CHARCOAL,
          fontSize: SECTION_TITLE_FONT_SIZE,
          fontWeight: '700',
          textAlign: 'left',
          alignSelf: 'stretch',
          marginTop: CAROUSEL_SECTION_GAP,
          marginBottom: 4,
        }}
      >
        Workshops near you
      </Text>
      <Text
        style={{
          color: MEDIUM_GRAY,
          fontSize: SECTION_SUBTITLE_FONT_SIZE,
          fontWeight: '400',
          textAlign: 'left',
          alignSelf: 'stretch',
          marginBottom: 6,
        }}
      >
        Explore nearby classes
      </Text>
      <WorkshopsNearYouCarousel
        userLocationAnchor={carouselLocationAnchor}
        showHintWhenNoLocation
        refreshNonce={homeRefreshNonce}
      />
      </ScrollView>

      {popupCategory !== null ? (
      <Modal
        visible
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={() => setPopupCategory(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onPress={() => setPopupCategory(null)}
        >
          <Pressable
            style={{
              backgroundColor: DesignColors.creamBg,
              borderRadius: 16,
              padding: 24,
              minWidth: 240,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {popupCategory !== null && (() => {
              const { level: popupLevel, points: popupPoints } = getLevelForCategory(popupCategory);
              const { label: popupLabel } = popupLevel === 'Instructor' ? { label: '' } : getLevelProgress(popupLevel, popupPoints);
              return (
              <>
                <Text
                  style={{
                    fontSize: 15,
                    color: DesignColors.mediumGray,
                    marginBottom: 4,
                  }}
                >
                  {popupCategory}
                </Text>
                {popupLevel === 'Instructor' ? (
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: '700',
                      color: DesignColors.primary,
                    }}
                  >
                    Instructor
                  </Text>
                ) : (
                  <>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '700',
                        color: DesignColors.charcoal,
                        marginBottom: popupLevel === 'Master' ? 0 : 4,
                      }}
                    >
                      {popupLevel}
                    </Text>
                    <Text
                      style={{
                        fontSize: 15,
                        color: DesignColors.mediumGray,
                      }}
                    >
                      {popupLabel}
                    </Text>
                  </>
                )}
                <Pressable
                  onPress={() => setPopupCategory(null)}
                  style={{
                    marginTop: 16,
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                    borderRadius: 9999,
                    backgroundColor: DesignColors.primary,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFF' }}>
                    OK
                  </Text>
                </Pressable>
              </>
            );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
      ) : null}
    </View>
  );
}
