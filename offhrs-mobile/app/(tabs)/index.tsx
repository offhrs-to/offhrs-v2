import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { CATEGORIES } from '@/constants/categories';

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

// Button width so 2 fit per row (after HORIZONTAL_PADDING and CATEGORY_GAP)
const getCategoryButtonWidth = () =>
  (Dimensions.get('window').width - HORIZONTAL_PADDING * 2 - CATEGORY_GAP) / 2;

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ expertise_level: string | null; experience_points: number | null } | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('expertise_level, experience_points')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setProfile(data ?? null));
  }, [user?.id]);

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Guest';
  const level = profile?.expertise_level || 'Novice';
  const points = profile?.experience_points ?? 0;
  // When not logged in, show placeholder so layout is visible
  const displayLevel = user ? level : 'Novice';
  const displayPoints = user ? points : 3;
  const { progress: levelProgress, label: levelLabel } = getLevelProgress(displayLevel, displayPoints);

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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: '#E0E0E0',
              }}
            />
            <View>
              <Text
                className="text-xs"
                style={{ color: MEDIUM_GRAY, fontFamily: Fonts?.serif ?? undefined }}
              >
                Welcome
              </Text>
              <Text
                className="text-xl font-bold"
                style={{ color: CHARCOAL, fontFamily: Fonts?.serif ?? undefined }}
              >
                {displayName}
              </Text>
            </View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minWidth: 100,
            }}
          >
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: HERO_BG,
                borderWidth: 1,
                borderColor: LIGHT_GREEN_BORDER,
              }}
            >
              <MaterialIcons name="emoji-events" size={22} color={SAGE_GREEN} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: SAGE_GREEN }}>{displayLevel}</Text>
                <View
                  style={{
                    marginTop: 4,
                    width: 72,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#E0E0E0',
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${levelProgress * 100}%`,
                      height: '100%',
                      backgroundColor: SAGE_GREEN,
                      borderRadius: 3,
                    }}
                  />
                </View>
              <Text style={{ fontSize: 10, color: MEDIUM_GRAY, marginTop: 2 }}>{levelLabel}</Text>
            </View>
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
          style={{ color: CHARCOAL, fontFamily: Fonts?.serif ?? undefined, textAlign: 'center', marginTop: 16, marginBottom: 8 }}
        >
          Discover your new passion
        </Text>
        <Text
          style={{ color: CHARCOAL, fontStyle: 'italic', fontFamily: Fonts?.serif ?? undefined, textAlign: 'center', marginBottom: 12, fontSize: 27 }}
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

      {/* Categories (styled like “What’s your current mood?”) */}
      <Text
        className="font-bold"
        style={{
          color: CHARCOAL,
          fontFamily: Fonts?.serif ?? undefined,
          fontSize: 15,
          marginTop: 14,
          marginBottom: 12,
        }}
      >
        What sparks your curiosity? Curate your discovery
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: CATEGORY_GAP }}>
        {CATEGORIES.filter((cat) => cat !== 'Other').map((cat) => {
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
      <View style={{ flex: 1, justifyContent: 'center', marginTop: 8 }}>
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
    </View>
  );
}
