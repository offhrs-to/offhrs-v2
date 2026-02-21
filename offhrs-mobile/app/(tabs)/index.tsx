import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { UserCircleIcon } from 'react-native-heroicons/outline';

import InstructorIcon from '@/components/InstructorIcon';
import OnboardingModal from '@/components/OnboardingModal';
import { CATEGORIES } from '@/constants/categories';
import { DesignColors } from '@/constants/design-template';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAddressSuggestions, type AddressSuggestion } from '@/lib/geocode';
import { supabase } from '@/lib/supabase';

const CATEGORY_GAP = 12;

const SAGE_GREEN = '#5D755D';
const LIGHT_GREEN_BORDER = '#A8C4A0';
const HERO_BG = '#E8F0E5';
const CREAM_BG = '#FDFCF8';
const CHARCOAL = '#2C2C2C';
const MEDIUM_GRAY = '#6B6B6B';

const HORIZONTAL_PADDING = 24;
const FIRST_TIME_SIGNUP_KEY = '@offhrs/hasSeenFirstTimeSignUpPrompt';

// Each level is 10 points; progression shown as X/10 for all levels (Novice → Master)
const LEVEL_THRESHOLDS: Record<string, { start: number; step: number }> = {
  Novice: { start: 0, step: 10 },
  Intermediate: { start: 10, step: 10 },
  Advanced: { start: 20, step: 10 },
  Expert: { start: 30, step: 10 },
  Master: { start: 40, step: 0 },
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
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressSuggestionsLoading, setAddressSuggestionsLoading] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const addressSuggestionsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Debounced address suggestions (Toronto-biased)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setAddressSuggestions([]);
      return;
    }
    if (addressSuggestionsDebounceRef.current) clearTimeout(addressSuggestionsDebounceRef.current);
    addressSuggestionsDebounceRef.current = setTimeout(() => {
      addressSuggestionsDebounceRef.current = null;
      setAddressSuggestionsLoading(true);
      fetchAddressSuggestions(q)
        .then((list) => setAddressSuggestions(list))
        .catch(() => setAddressSuggestions([]))
        .finally(() => setAddressSuggestionsLoading(false));
    }, 300);
    return () => {
      if (addressSuggestionsDebounceRef.current) clearTimeout(addressSuggestionsDebounceRef.current);
    };
  }, [searchQuery]);

  const handleBrowse = () => {
    setShowAddressSuggestions(false);
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

  const pickAddressSuggestion = useCallback((suggestion: AddressSuggestion) => {
    setSearchQuery(suggestion.display);
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: CREAM_BG }}>
      {showOnboarding && user && (
        <OnboardingModal userId={user.id} onComplete={refreshProfile} />
      )}
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
              backgroundColor: avatarUrl ? 'transparent' : '#E0E0E0',
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: 52, height: 52 }}
                contentFit="cover"
              />
            ) : (
              <UserCircleIcon size={36} color={MEDIUM_GRAY} />
            )}
          </View>
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
          style={{ color: CHARCOAL, textAlign: 'center', marginTop: 16, marginBottom: 16 }}
        >
          Discover your new passion
        </Text>
        <Text
          style={{ color: CHARCOAL, textAlign: 'center', marginBottom: 20, fontSize: 27 }}
        >
          Where are you looking?
        </Text>
        <View style={{ marginHorizontal: 20, marginTop: 8, marginBottom: 12, position: 'relative' }}>
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
            }}
          >
            <TextInput
              placeholder="Enter your address..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setShowAddressSuggestions(true)}
              onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 200)}
              onSubmitEditing={handleBrowse}
              returnKeyType="search"
              className="flex-1"
              style={{ color: CHARCOAL, paddingVertical: 0, fontSize: 12 }}
            />
            <Text style={{ color: SAGE_GREEN, fontSize: 14 }}>→</Text>
          </Pressable>
          {showAddressSuggestions && (addressSuggestions.length > 0 || addressSuggestionsLoading) && (
            <View
              style={{
                position: 'absolute',
                top: 40,
                left: 0,
                right: 0,
                backgroundColor: CREAM_BG,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: LIGHT_GREEN_BORDER,
                maxHeight: 220,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 4,
                zIndex: 10,
              }}
            >
              {addressSuggestionsLoading ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: MEDIUM_GRAY, fontSize: 13 }}>Loading suggestions…</Text>
                </View>
              ) : (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  style={{ maxHeight: 216 }}
                  showsVerticalScrollIndicator={true}
                >
                  {addressSuggestions.map((s) => (
                    <Pressable
                      key={`${s.display}-${s.lat}-${s.lng}`}
                      onPress={() => pickAddressSuggestion(s)}
                      style={({ pressed }) => ({
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: '#EEE',
                        backgroundColor: pressed ? HERO_BG : 'transparent',
                      })}
                    >
                      <Text
                        numberOfLines={2}
                        style={{ color: CHARCOAL, fontSize: 13 }}
                      >
                        {s.display}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Level icons bar: all categories (Beauty & Fragrance, Culinary, Coffee, Floral, Pottery, Music, Wellness, Other) use level-specific icons (Novice → Master).
          - Instructor categories show graduation cap icon and "Instructor" (no progression) in popup. */}
      <View style={{ marginTop: 18, marginBottom: 8, height: 56, width: '100%', flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>
        {levelCategories.map((cat) => {
          const isInstructor = isInstructorForCategory(cat);
          const catLevel = getLevelForCategory(cat).level;
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
                    source={getFloralIconSource(catLevel)}
                    style={{ width: 58, height: 58, position: 'absolute', left: -7, top: -7 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Culinary' ? (
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                  <Image
                    source={getCulinaryIconSource(catLevel)}
                    style={{ width: 56, height: 56, position: 'absolute', left: -6, top: -6 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Pottery' ? (
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                  <Image
                    source={getPotteryIconSource(catLevel)}
                    style={{ width: 66, height: 66, position: 'absolute', left: -11, top: -11 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Coffee' ? (
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                  <Image
                    source={getCoffeeIconSource(catLevel)}
                    style={{ width: 56, height: 56, position: 'absolute', left: -6, top: -6 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Beauty & Fragrance' ? (
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                  <Image
                    source={getBeautyFragranceIconSource(catLevel)}
                    style={{ width: 62, height: 62, position: 'absolute', left: -9, top: -9 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Music' ? (
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                  <Image
                    source={getMusicIconSource(catLevel)}
                    style={{ width: 62, height: 62, position: 'absolute', left: -9, top: -9 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Wellness' ? (
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                  <Image
                    source={getWellnessIconSource(catLevel)}
                    style={{ width: 58, height: 58, position: 'absolute', left: -7, top: -7 }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Other' ? (
                <Image
                  source={getOtherIconSource(catLevel)}
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
                    {popupLevel !== 'Master' && (
                      <Text
                        style={{
                          fontSize: 15,
                          color: DesignColors.mediumGray,
                        }}
                      >
                        {popupLabel}
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
            );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
