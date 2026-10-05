import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import {
  DeviceEventEmitter,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import InstructorIcon from '@/components/InstructorIcon';
import { CATEGORIES } from '@/constants/categories';
import { DesignColors, isIOSPad } from '@/constants/design-template';
import { PROFILE_UPDATED_EVENT } from '@/lib/profile-events';
import { supabase } from '@/lib/supabase';

const CHARCOAL = '#2C2C2C';

const isAndroid = Platform.OS === 'android';
const ICON_BAR_HEIGHT = isAndroid ? 48 : 56;
const ICON_CIRCLE_SIZE = isAndroid ? 40 : 44;
const SECTION_TITLE_FONT_SIZE = isAndroid ? 14 : 15;

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

const FLORAL_ICONS: Record<string, any> = {
  Novice: require('@/assets/images/floral-novice.png'),
  Intermediate: require('@/assets/images/floral-intermediate.png'),
  Advanced: require('@/assets/images/floral-advanced.png'),
  Expert: require('@/assets/images/floral-expert.png'),
  Master: require('@/assets/images/floral-master.png'),
};

const getFloralIconSource = (level: string) => FLORAL_ICONS[level] ?? FLORAL_ICONS.Novice;

const CULINARY_ICONS: Record<string, any> = {
  Novice: require('@/assets/images/culinary-novice.png'),
  Intermediate: require('@/assets/images/culinary-intermediate.png'),
  Advanced: require('@/assets/images/culinary-advanced.png'),
  Expert: require('@/assets/images/culinary-expert.png'),
  Master: require('@/assets/images/culinary-master.png'),
};

const getCulinaryIconSource = (level: string) => CULINARY_ICONS[level] ?? CULINARY_ICONS.Novice;

const POTTERY_ICONS: Record<string, any> = {
  Novice: require('@/assets/images/pottery-novice.png'),
  Intermediate: require('@/assets/images/pottery-intermediate.png'),
  Advanced: require('@/assets/images/pottery-advanced.png'),
  Expert: require('@/assets/images/pottery-expert.png'),
  Master: require('@/assets/images/pottery-master.png'),
};

const getPotteryIconSource = (level: string) => POTTERY_ICONS[level] ?? POTTERY_ICONS.Novice;

const COFFEE_ICONS: Record<string, any> = {
  Novice: require('@/assets/images/coffee-novice.png'),
  Intermediate: require('@/assets/images/coffee-intermediate.png'),
  Advanced: require('@/assets/images/coffee-advanced.png'),
  Expert: require('@/assets/images/coffee-expert.png'),
  Master: require('@/assets/images/coffee-master.png'),
};

const getCoffeeIconSource = (level: string) => COFFEE_ICONS[level] ?? COFFEE_ICONS.Novice;

const SCENT_CANDLE_ICONS: Record<string, any> = {
  Novice: require('@/assets/images/beauty-fragrance-novice.png'),
  Intermediate: require('@/assets/images/beauty-fragrance-intermediate.png'),
  Advanced: require('@/assets/images/beauty-fragrance-advanced.png'),
  Expert: require('@/assets/images/beauty-fragrance-expert.png'),
  Master: require('@/assets/images/beauty-fragrance-master.png'),
};

const getScentCandleIconSource = (level: string) =>
  SCENT_CANDLE_ICONS[level] ?? SCENT_CANDLE_ICONS.Novice;

const OTHER_ICONS: Record<string, any> = {
  Novice: require('@/assets/images/other-novice.png'),
  Intermediate: require('@/assets/images/other-intermediate.png'),
  Advanced: require('@/assets/images/other-advanced.png'),
  Expert: require('@/assets/images/other-expert.png'),
  Master: require('@/assets/images/other-master.png'),
};

const getOtherIconSource = (level: string) => OTHER_ICONS[level] ?? OTHER_ICONS.Novice;

type Props = {
  userId: string;
};

/**
 * Home “Your mastery progression” icon bar + level popup.
 * Gated by MASTERY_FEATURE_ENABLED — kept intact so the feature can be re-enabled.
 */
export default function MasteryProgressionSection({ userId }: Props) {
  const isIPad = isIOSPad();
  const [instructorCategories, setInstructorCategories] = useState<string[]>([]);
  const [categoryExperience, setCategoryExperience] = useState<
    Record<string, { level: string; points: number }>
  >({});
  const [popupCategory, setPopupCategory] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [{ data: profileData }, { data: catRows }] = await Promise.all([
      supabase.from('profiles').select('instructor_categories').eq('id', userId).single(),
      supabase
        .from('profile_category_experience')
        .select('category, expertise_level, experience_points')
        .eq('user_id', userId),
    ]);
    setInstructorCategories(profileData?.instructor_categories ?? []);
    const map: Record<string, { level: string; points: number }> = {};
    (catRows ?? []).forEach((row) => {
      map[row.category] = {
        level: row.expertise_level ?? 'Novice',
        points: row.experience_points ?? 0,
      };
    });
    setCategoryExperience(map);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(PROFILE_UPDATED_EVENT, () => {
      void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const isInstructorForCategory = (cat: string) => instructorCategories.includes(cat);
  const getLevelForCategory = (cat: string) => {
    if (isInstructorForCategory(cat)) return { level: 'Instructor', points: 0 };
    const ce = categoryExperience[cat];
    return ce ? { level: ce.level, points: ce.points } : { level: 'Novice', points: 0 };
  };

  return (
    <>
      <Text
        style={{
          color: CHARCOAL,
          fontSize: SECTION_TITLE_FONT_SIZE,
          fontWeight: '700',
          textAlign: 'left',
          alignSelf: 'stretch',
          marginTop: isAndroid ? 2 : 4,
          marginBottom: isIPad ? 10 : isAndroid ? 6 : 8,
        }}
      >
        Your mastery progression
      </Text>

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
        {CATEGORIES.map((cat) => {
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
                <View
                  style={{
                    width: circleSize,
                    height: circleSize,
                    borderRadius: circleSize / 2,
                    overflow: 'hidden',
                  }}
                >
                  <Image
                    source={getFloralIconSource(catLevel)}
                    style={{
                      width: circleSize + 14,
                      height: circleSize + 14,
                      position: 'absolute',
                      left: -7,
                      top: -7,
                    }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Culinary' ? (
                <View
                  style={{
                    width: circleSize,
                    height: circleSize,
                    borderRadius: circleSize / 2,
                    overflow: 'hidden',
                  }}
                >
                  <Image
                    source={getCulinaryIconSource(catLevel)}
                    style={{
                      width: circleSize + 12,
                      height: circleSize + 12,
                      position: 'absolute',
                      left: -6,
                      top: -6,
                    }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Pottery' ? (
                <View
                  style={{
                    width: circleSize,
                    height: circleSize,
                    borderRadius: circleSize / 2,
                    overflow: 'hidden',
                  }}
                >
                  <Image
                    source={getPotteryIconSource(catLevel)}
                    style={{
                      width: circleSize + 22,
                      height: circleSize + 22,
                      position: 'absolute',
                      left: -11,
                      top: -11,
                    }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Coffee' ? (
                <View
                  style={{
                    width: circleSize,
                    height: circleSize,
                    borderRadius: circleSize / 2,
                    overflow: 'hidden',
                  }}
                >
                  <Image
                    source={getCoffeeIconSource(catLevel)}
                    style={{
                      width: circleSize + 12,
                      height: circleSize + 12,
                      position: 'absolute',
                      left: -6,
                      top: -6,
                    }}
                    contentFit="cover"
                  />
                </View>
              ) : cat === 'Scent & Candle' ? (
                <View
                  style={{
                    width: circleSize,
                    height: circleSize,
                    borderRadius: circleSize / 2,
                    overflow: 'hidden',
                  }}
                >
                  <Image
                    source={getScentCandleIconSource(catLevel)}
                    style={{
                      width: circleSize + 18,
                      height: circleSize + 18,
                      position: 'absolute',
                      left: -9,
                      top: -9,
                    }}
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
              {(() => {
                const { level: popupLevel, points: popupPoints } = getLevelForCategory(popupCategory);
                const { label: popupLabel } =
                  popupLevel === 'Instructor'
                    ? { label: '' }
                    : getLevelProgress(popupLevel, popupPoints);
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
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFF' }}>OK</Text>
                    </Pressable>
                  </>
                );
              })()}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}
