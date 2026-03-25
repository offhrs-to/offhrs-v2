import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { UserCircleIcon } from 'react-native-heroicons/outline';

import InstructorIcon from '@/components/InstructorIcon';
import UpcomingTorontoCarousel from '@/components/UpcomingTorontoCarousel';
import OnboardingModal from '@/components/OnboardingModal';
import { CATEGORIES } from '@/constants/categories';
import { DesignColors, DesignSizes, DesignSpacing } from '@/constants/design-template';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const CATEGORY_GAP = 12;
const CATEGORY_GAP_ANDROID = 8;

const SAGE_GREEN = '#5D755D';
const LIGHT_GREEN_BORDER = '#A8C4A0';
const CREAM_BG = '#FDFCF8';
/** Display serif for hero headline (elegant, close to reference). */
const HERO_SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
const CHARCOAL = '#2C2C2C';
const MEDIUM_GRAY = '#6B6B6B';

const HORIZONTAL_PADDING = 24;
const FIRST_TIME_SIGNUP_KEY = '@offhrs/hasSeenFirstTimeSignUpPrompt';

const isAndroid = Platform.OS === 'android';
const AVATAR_SIZE = isAndroid ? 46 : 52;
/** Space below header divider before hero — keep small so headline sits close to grey line. */
const SCROLL_PADDING_TOP = isAndroid ? 4 : 6;
/** Scroll padding below Browse — Android needs extra so CTA clears floating tab bar. */
const SCROLL_PADDING_BOTTOM = isAndroid ? 76 : 28;
const HERO_HEADLINE_FONT_SIZE = isAndroid ? 30 : 34;
const HERO_HEADLINE_LINE_HEIGHT = isAndroid ? 38 : 42;
const ICON_BAR_HEIGHT = isAndroid ? 48 : 56;
const ICON_CIRCLE_SIZE = isAndroid ? 40 : 44;
const CURIOSITY_FONT_SIZE = isAndroid ? 14 : 15;
/** Space above curiosity heading — paired with level-row marginBottom so gap matches search→icons. */
const CURIOSITY_MARGIN_TOP = isAndroid ? 5 : 6;
const CURIOSITY_MARGIN_BOTTOM = isAndroid ? 8 : 12;
/** Half of the vertical rhythm between search / level icons / curiosity (margin pairs sum to this). */
const LEVEL_SECTION_GAP = isAndroid ? 5 : 6;
const CATEGORY_BUTTON_HEIGHT = isAndroid ? 42 : 44;
const BROWSE_MARGIN_TOP = isAndroid ? 14 : 16;
const BROWSE_PADDING_VERTICAL = isAndroid ? 10 : 12;

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

// Button width so 2 fit per row (after HORIZONTAL_PADDING and gap)
const getCategoryButtonWidth = () => {
  const gap = isAndroid ? CATEGORY_GAP_ANDROID : CATEGORY_GAP;
  return (Dimensions.get('window').width - HORIZONTAL_PADDING * 2 - gap) / 2;
};

export default function HomeScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [showFirstTimeSignUpPrompt, setShowFirstTimeSignUpPrompt] = useState(false);
  const [profile, setProfile] = useState<{
    display_name: string | null;
    avatar_url: string | null;
    expertise_level: string | null;
    experience_points: number | null;
    instructor_categories: string[] | null;
    onboarding_completed: boolean | null;
  } | null>(null);
  const [categoryExperience, setCategoryExperience] = useState<Record<string, { level: string; points: number }>>({});
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [popupCategory, setPopupCategory] = useState<string | null>(null);

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
        .select('display_name, avatar_url, expertise_level, experience_points, instructor_categories, onboarding_completed')
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

  const refreshProfile = () => {
    if (!user?.id) return;
    Promise.all([
      supabase
        .from('profiles')
        .select('display_name, avatar_url, expertise_level, experience_points, instructor_categories, onboarding_completed')
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
  };

  const showOnboarding =
    user &&
    profileLoaded &&
    (profile == null || profile.onboarding_completed === false);

  useEffect(() => {
    if (authLoading || user) return;
    AsyncStorage.getItem(FIRST_TIME_SIGNUP_KEY).then((seen) => {
      if (seen !== 'true') setShowFirstTimeSignUpPrompt(true);
    });
  }, [authLoading, user]);

  const dismissFirstTimePrompt = (goToSignUp: boolean) => {
    AsyncStorage.setItem(FIRST_TIME_SIGNUP_KEY, 'true');
    setShowFirstTimeSignUpPrompt(false);
    if (goToSignUp) router.push('/(tabs)/profile');
  };

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
  const level = profile?.expertise_level || 'Novice';
  const points = profile?.experience_points ?? 0;
  const displayLevel = user ? level : 'Novice';
  const displayPoints = user ? points : 0;
  const { progress: levelProgress, label: levelLabel } = getLevelProgress(displayLevel, displayPoints);

  const isInstructorForCategory = (cat: string) => instructorCategories.includes(cat);
  const getLevelForCategory = (cat: string) => {
    if (isInstructorForCategory(cat)) return { level: 'Instructor', points: 0 };
    const ce = categoryExperience[cat];
    return ce ? { level: ce.level, points: ce.points } : { level: displayLevel, points: displayPoints };
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleBrowse = () => {
    const params = new URLSearchParams();
    if (selectedCategories.length > 0) {
      params.set('categories', selectedCategories.join(','));
    }
    if (searchQuery.trim()) {
      params.set('address', searchQuery.trim());
    }
    const query = params.toString();
    router.push(query ? `/(tabs)/workshops?${query}` : '/(tabs)/workshops');
  };

  return (
    <View style={{ flex: 1, backgroundColor: CREAM_BG }}>
      {showOnboarding && user && (
        <OnboardingModal userId={user.id} onComplete={refreshProfile} />
      )}
      {/* Fixed header: logo + welcome row (stays in place when scrolling) */}
      <View
        style={{
          paddingTop: DesignSpacing.contentPaddingTop,
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
          <View style={{ marginLeft: DesignSpacing.logoMarginLeft, paddingLeft: 0, flexShrink: 0 }}>
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
          paddingBottom: SCROLL_PADDING_BOTTOM,
          paddingHorizontal: HORIZONTAL_PADDING,
        }}
        showsVerticalScrollIndicator={false}
      >
      {/* Hero headline + search (open layout on cream, no tinted card) */}
      <View style={{ marginTop: isAndroid ? 2 : 4, marginBottom: LEVEL_SECTION_GAP }}>
        <Text
          style={{
            color: CHARCOAL,
            textAlign: 'left',
            fontFamily: HERO_SERIF_FONT,
            fontSize: HERO_HEADLINE_FONT_SIZE,
            lineHeight: HERO_HEADLINE_LINE_HEIGHT,
            fontWeight: '400',
            letterSpacing: isAndroid ? 0 : -0.2,
          }}
        >
          Discover your new passion.
        </Text>
        <Pressable
          onPress={handleBrowse}
          style={{
            marginTop: isAndroid ? 12 : 14,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: 9999,
            borderWidth: 1,
            borderColor: '#E5E5E5',
            paddingHorizontal: isAndroid ? 10 : 12,
            paddingVertical: isAndroid ? 6 : 8,
            minHeight: isAndroid ? 36 : 38,
          }}
        >
          <TextInput
            placeholder="Enter your address (street, city, state, zip)"
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleBrowse}
            returnKeyType="search"
            className="flex-1"
            style={{
              color: CHARCOAL,
              paddingVertical: 0,
              fontSize: isAndroid ? 12 : 13,
              minHeight: isAndroid ? 22 : 24,
            }}
          />
          <Text style={{ color: SAGE_GREEN, fontSize: 14, fontWeight: '600' }}>→</Text>
        </Pressable>
      </View>

      {/* Level icons bar: categories use level-specific icons (Novice → Master).
          - Instructor categories show graduation cap icon and "Instructor" (no progression) in popup. */}
      <View
        style={{
          marginTop: LEVEL_SECTION_GAP,
          marginBottom: LEVEL_SECTION_GAP,
          height: ICON_BAR_HEIGHT,
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

      {/* Category pills — above upcoming carousel */}
      <Text
        className="font-bold"
        style={{
          color: CHARCOAL,
          fontSize: CURIOSITY_FONT_SIZE,
          marginTop: CURIOSITY_MARGIN_TOP,
          marginBottom: CURIOSITY_MARGIN_BOTTOM,
        }}
      >
        What sparks your curiosity? Curate your discovery
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: isAndroid ? CATEGORY_GAP_ANDROID : CATEGORY_GAP }}>
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategories.includes(cat);
          return (
            <Pressable
              key={cat}
              onPress={() => toggleCategory(cat)}
              style={{
                width: getCategoryButtonWidth(),
                height: CATEGORY_BUTTON_HEIGHT,
                paddingHorizontal: isAndroid ? 14 : 16,
                paddingVertical: isAndroid ? 6 : 7,
                borderRadius: 9999,
                backgroundColor: isActive ? SAGE_GREEN : CREAM_BG,
                borderWidth: 1,
                borderColor: LIGHT_GREEN_BORDER,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text
                className="font-medium"
                style={{
                  fontSize: 11,
                  color: isActive ? '#FFF' : SAGE_GREEN,
                  textAlign: 'center',
                  alignSelf: 'stretch',
                }}
              >
                {cat}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Upcoming Toronto-area picks (one per key category); tap → Workshops quick view */}
      <Text
        className="font-bold"
        style={{
          color: CHARCOAL,
          fontSize: CURIOSITY_FONT_SIZE,
          marginTop: isAndroid ? 10 : 12,
          marginBottom: 6,
        }}
      >
        Upcoming workshops in Toronto…
      </Text>
      {/* Carousel sits inside ScrollView padding — no extra ListHeader inset (avoids double left gap). */}
      <UpcomingTorontoCarousel />
      <View style={{ marginTop: BROWSE_MARGIN_TOP }}>
        <Pressable
          onPress={handleBrowse}
          style={{
            paddingVertical: BROWSE_PADDING_VERTICAL,
            paddingHorizontal: 24,
            borderRadius: 9999,
            backgroundColor: '#38511B',
            borderWidth: 1,
            borderColor: '#38511B',
            justifyContent: 'center',
            alignItems: 'center',
            alignSelf: 'stretch',
          }}
        >
          <Text
            className="text-sm font-medium"
            style={{ color: '#FFF', textAlign: 'center', fontSize: isAndroid ? 13 : undefined }}
          >
            Browse Workshops
          </Text>
        </Pressable>
      </View>
      </ScrollView>

      <Modal
        visible={showFirstTimeSignUpPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => dismissFirstTimePrompt(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onPress={() => dismissFirstTimePrompt(false)}
        >
          <Pressable
            style={{
              backgroundColor: DesignColors.creamBg,
              borderRadius: 16,
              padding: 24,
              minWidth: 280,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: DesignColors.charcoal,
                textAlign: 'center',
                marginBottom: 24,
              }}
            >
              Sign-up to create your profile and begin tracking your Mastery!
            </Text>
            <View style={{ gap: 12 }}>
              <Pressable
                onPress={() => dismissFirstTimePrompt(true)}
                style={{
                  paddingVertical: 14,
                  borderRadius: 9999,
                  backgroundColor: DesignColors.primary,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFF' }}>
                  Sign up
                </Text>
              </Pressable>
              <Pressable
                onPress={() => dismissFirstTimePrompt(false)}
                style={{
                  paddingVertical: 14,
                  borderRadius: 9999,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 16, color: DesignColors.mediumGray }}>
                  Maybe later
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={popupCategory !== null}
        transparent
        animationType="fade"
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
    </View>
  );
}
