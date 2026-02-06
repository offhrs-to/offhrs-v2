import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import InstructorIcon from '@/components/InstructorIcon';
import { CATEGORIES } from '@/constants/categories';
import { DesignColors } from '@/constants/design-template';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const CATEGORY_GAP = 12;

const SAGE_GREEN = '#5D755D';
const LIGHT_GREEN_BORDER = '#A8C4A0';
const HERO_BG = '#E8F0E5';
const CREAM_BG = '#FDFCF8';
const CHARCOAL = '#2C2C2C';
const MEDIUM_GRAY = '#6B6B6B';

const HORIZONTAL_PADDING = 24;

const LEVEL_THRESHOLDS: Record<string, { start: number; step: number }> = {
  Novice: { start: 0, step: 10 },
  Intermediate: { start: 10, step: 10 },
  Advanced: { start: 20, step: 20 },
  Expert: { start: 40, step: 40 },
  Master: { start: 80, step: 0 },
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

// Music category uses bespoke icons per level (Novice → Master)
const MUSIC_ICONS: Record<string, any> = {
  Novice: require('@/assets/images/music-novice.png'),
  Intermediate: require('@/assets/images/music-intermediate.png'),
  Advanced: require('@/assets/images/music-advanced.png'),
  Expert: require('@/assets/images/music-expert.png'),
  Master: require('@/assets/images/music-master.png'),
};

const getMusicIconSource = (level: string) =>
  MUSIC_ICONS[level] ?? MUSIC_ICONS.Novice;

// Wellness category uses bespoke icons per level (Novice → Master)
const WELLNESS_ICONS: Record<string, any> = {
  Novice: require('@/assets/images/wellness-novice.png'),
  Intermediate: require('@/assets/images/wellness-intermediate.png'),
  Advanced: require('@/assets/images/wellness-advanced.png'),
  Expert: require('@/assets/images/wellness-expert.png'),
  Master: require('@/assets/images/wellness-master.png'),
};

const getWellnessIconSource = (level: string) =>
  WELLNESS_ICONS[level] ?? WELLNESS_ICONS.Novice;

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

// Button width so 2 fit per row (after HORIZONTAL_PADDING and CATEGORY_GAP)
const getCategoryButtonWidth = () =>
  (Dimensions.get('window').width - HORIZONTAL_PADDING * 2 - CATEGORY_GAP) / 2;

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<{
    expertise_level: string | null;
    experience_points: number | null;
    instructor_categories: string[] | null;
  } | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [popupCategory, setPopupCategory] = useState<string | null>(null);

  const levelCategories = CATEGORIES;
  const instructorCategories = profile?.instructor_categories ?? [];

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('expertise_level, experience_points, instructor_categories')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setProfile(data ?? null));
  }, [user?.id]);

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Guest';
  // Default: Novice in all categories with 0/10 progression (unless set by years of experience in onboarding)
  const level = profile?.expertise_level || 'Novice';
  const points = profile?.experience_points ?? 0;
  const displayLevel = user ? level : 'Novice';
  const displayPoints = user ? points : 0;
  const { progress: levelProgress, label: levelLabel } = getLevelProgress(displayLevel, displayPoints);

  const isInstructorForCategory = (cat: string) => instructorCategories.includes(cat);

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
      params.set('q', searchQuery.trim());
    }
    const query = params.toString();
    router.push(query ? `/(tabs)/workshops?${query}` : '/(tabs)/workshops');
  };

  return (
    <View style={{ flex: 1, backgroundColor: CREAM_BG }}>
      {/* Fixed header: logo + welcome row (stays in place when scrolling) */}
      <View
        style={{
          paddingTop: 48,
          paddingBottom: 12,
          paddingHorizontal: HORIZONTAL_PADDING,
          backgroundColor: CREAM_BG,
        }}
      >
        <View style={{ marginLeft: -40, paddingLeft: 0, marginBottom: 16 }}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={{ height: 48, width: 160 }}
            contentFit="contain"
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: '#E0E0E0',
            }}
          />
          <View style={{ marginLeft: 12 }}>
            <Text
              className="text-xs"
              style={{ color: MEDIUM_GRAY }}
            >
              Welcome
            </Text>
            <Text
              className="text-xl font-bold"
              style={{ color: CHARCOAL }}
            >
              {displayName}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: 16,
          paddingBottom: 32,
          paddingHorizontal: HORIZONTAL_PADDING,
        }}
        showsVerticalScrollIndicator={false}
      >
      {/* Hero / Reflection-style card */}
      <View
        className="mb-4 rounded-2xl px-6 pt-5"
        style={{ backgroundColor: HERO_BG, borderRadius: 18, marginTop: 0, paddingBottom: 14 }}
      >
        <Text
          className="text-lg font-bold"
          style={{ color: CHARCOAL, textAlign: 'center', marginTop: 16, marginBottom: 8 }}
        >
          Discover your new passion
        </Text>
        <Text
          style={{ color: CHARCOAL, textAlign: 'center', marginBottom: 12, fontSize: 27 }}
        >
          What would you like to learn?
        </Text>
        <Pressable
          onPress={handleBrowse}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#F5F5F5',
            borderRadius: 9999,
            borderWidth: 1,
            borderColor: LIGHT_GREEN_BORDER,
            paddingHorizontal: 12,
            paddingVertical: 9,
            marginHorizontal: 20,
          }}
        >
          <TextInput
            placeholder="Search classes..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleBrowse}
            returnKeyType="search"
            className="flex-1"
            style={{ color: CHARCOAL, paddingVertical: 0, fontSize: 12 }}
          />
          <Text style={{ color: SAGE_GREEN, fontSize: 14 }}>→</Text>
        </Pressable>
      </View>

      {/* Level icons bar: all categories (Beauty & Fragrance, Culinary, Coffee, Floral, Pottery, Music, Wellness, Other) use level-specific icons (Novice → Master).
          - Instructor categories show graduation cap icon and "Instructor" (no progression) in popup. */}
      <View style={{ marginTop: 18, marginBottom: 8, height: 56, width: '100%', flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>
        {levelCategories.map((cat) => {
          const isInstructor = isInstructorForCategory(cat);
          return (
            <Pressable
              key={cat}
              onPress={() => setPopupCategory(cat)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: 2,
                borderColor: DesignColors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {isInstructor ? (
                <InstructorIcon size={20} color={DesignColors.primary} />
              ) : cat === 'Floral' ? (
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                  <Image
                    source={getFloralIconSource(displayLevel)}
                    style={{ width: 58, height: 58, position: 'absolute', left: -7, top: -7 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Culinary' ? (
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                  <Image
                    source={getCulinaryIconSource(displayLevel)}
                    style={{ width: 56, height: 56, position: 'absolute', left: -6, top: -6 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Pottery' ? (
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                  <Image
                    source={getPotteryIconSource(displayLevel)}
                    style={{ width: 66, height: 66, position: 'absolute', left: -11, top: -11 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Coffee' ? (
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                  <Image
                    source={getCoffeeIconSource(displayLevel)}
                    style={{ width: 56, height: 56, position: 'absolute', left: -6, top: -6 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Beauty & Fragrance' ? (
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                  <Image
                    source={getBeautyFragranceIconSource(displayLevel)}
                    style={{ width: 62, height: 62, position: 'absolute', left: -9, top: -9 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Music' ? (
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                  <Image
                    source={getMusicIconSource(displayLevel)}
                    style={{ width: 62, height: 62, position: 'absolute', left: -9, top: -9 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Wellness' ? (
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                  <Image
                    source={getWellnessIconSource(displayLevel)}
                    style={{ width: 58, height: 58, position: 'absolute', left: -7, top: -7 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Other' ? (
                <Image
                  source={getOtherIconSource(displayLevel)}
                  style={{ width: 32, height: 32 }}
                  contentFit="contain"
                />
              ) : (
                <MaterialIcons name="star" size={20} color={DesignColors.primary} />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Categories (styled like “What’s your current mood?”) */}
      <Text
        className="font-bold"
        style={{
          color: CHARCOAL,
          fontSize: 15,
          marginTop: 14,
          marginBottom: 12,
        }}
      >
        What sparks your curiosity? Curate your discovery
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: CATEGORY_GAP }}>
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategories.includes(cat);
          return (
            <Pressable
              key={cat}
              onPress={() => toggleCategory(cat)}
              style={{
                width: getCategoryButtonWidth(),
                height: 56,
                paddingHorizontal: 20,
                paddingVertical: 12,
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
      <View style={{ marginTop: 12 }}>
        <Pressable
          onPress={handleBrowse}
          style={{
            paddingVertical: 12,
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
            style={{ color: '#FFF', textAlign: 'center' }}
          >
            Browse Workshops
          </Text>
        </Pressable>
      </View>
      </ScrollView>

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
            {popupCategory !== null && (
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
                {isInstructorForCategory(popupCategory) ? (
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
                        marginBottom: displayLevel === 'Master' ? 0 : 4,
                      }}
                    >
                      {displayLevel}
                    </Text>
                    {displayLevel !== 'Master' && (
                      <Text
                        style={{
                          fontSize: 15,
                          color: DesignColors.mediumGray,
                        }}
                      >
                        {levelLabel}
                      </Text>
                    )}
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
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
