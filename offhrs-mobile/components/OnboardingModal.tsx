import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { CATEGORIES } from '@/constants/categories';
import { DesignColors } from '@/constants/design-template';

// Points align with level progression: each level = 10 pts (Novice 0, Intermediate 10, Advanced 20, Expert 30, Master 40)
const EXPERIENCE_OPTIONS = [
  { value: 'no_experience', label: 'No experience', level: 'Novice', points: 0 },
  { value: '0-1', label: '0-1 year', level: 'Novice', points: 0 },
  { value: '2-3', label: '2-3 years', level: 'Intermediate', points: 10 },
  { value: '3-5', label: '3-5 years', level: 'Advanced', points: 20 },
  { value: '5-10', label: '5-10 years', level: 'Expert', points: 30 },
  { value: '10+', label: '10+ years', level: 'Master', points: 40 },
] as const;

export default function OnboardingModal({
  userId,
  onComplete,
}: {
  userId: string;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [instructorCategories, setInstructorCategories] = useState<string[]>([]);
  /** Per-category experience (only for categories they're learning, not instructing). */
  const [experienceByCategory, setExperienceByCategory] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleInstructorCategory = (cat: string) => {
    setInstructorCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  /** Categories selected for learning (not instructor-only). */
  const learnerCategories = selectedCategories.filter((c) => !instructorCategories.includes(c));

  const setExperienceForCategory = (category: string, value: string) => {
    setExperienceByCategory((prev) => ({ ...prev, [category]: value }));
  };

  const canComplete =
    learnerCategories.length === 0 ||
    learnerCategories.every((cat) => experienceByCategory[cat] != null && experienceByCategory[cat] !== '');

  const handleComplete = async () => {
    if (!canComplete) return;
    setError(null);
    setLoading(true);
    try {
      const profilePayload = {
        id: userId,
        category_of_interest: selectedCategories.length > 0 ? selectedCategories : null,
        instructor_categories: instructorCategories.length > 0 ? instructorCategories : null,
        is_instructor: instructorCategories.length > 0,
        onboarding_completed: true,
      };

      let defaultLevel = 'Novice';
      let defaultPoints = 0;
      if (learnerCategories.length > 0) {
        const firstValue = experienceByCategory[learnerCategories[0]!];
        const option = EXPERIENCE_OPTIONS.find((o) => o.value === firstValue);
        defaultLevel = option?.level ?? 'Novice';
        defaultPoints = option?.points ?? 0;
      }
      const { error: profileError } = await supabase.from('profiles').upsert(
        { ...profilePayload, expertise_level: defaultLevel, experience_points: defaultPoints },
        { onConflict: 'id' }
      );
      if (profileError) throw profileError;

      for (const category of learnerCategories) {
        const value = experienceByCategory[category];
        if (!value) continue;
        const option = EXPERIENCE_OPTIONS.find((o) => o.value === value);
        const { error: rowError } = await supabase.from('profile_category_experience').upsert(
          {
            user_id: userId,
            category,
            expertise_level: option?.level ?? 'Novice',
            experience_points: option?.points ?? 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,category' }
        );
        if (rowError) throw rowError;
      }

      onComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
      console.error('Onboarding error:', err);
      Alert.alert('Couldn’t save', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 50,
        padding: 24,
      }}
    >
      <View
        pointerEvents="auto"
        style={{
          width: '100%',
          maxWidth: 400,
          backgroundColor: '#FFF',
          borderRadius: 16,
          padding: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: '700',
            color: DesignColors.charcoal,
            marginBottom: 8,
          }}
        >
          {step === 1 ? "What sparks your curiosity?" : "What's your experience level?"}
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: DesignColors.mediumGray,
            marginBottom: 24,
          }}
        >
          {step === 1
            ? 'Select interests and optionally mark categories where you teach'
            : "We'll use this to personalize your experience"}
        </Text>

        {step === 1 ? (
          <>
            <ScrollView
              style={{ maxHeight: 360 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.charcoal, marginBottom: 8 }}>
                What sparks your curiosity?
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                {CATEGORIES.map((cat) => {
                  const isActive = selectedCategories.includes(cat);
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => toggleCategory(cat)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 9999,
                        backgroundColor: isActive ? DesignColors.primary : DesignColors.inputBg,
                        borderWidth: 1,
                        borderColor: DesignColors.lightGreenBorder,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '500',
                          color: isActive ? '#FFF' : DesignColors.sageGreen,
                        }}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.charcoal, marginBottom: 8 }}>
                I'm an Instructor in (optional)
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {CATEGORIES.map((cat) => {
                  const isInstructor = instructorCategories.includes(cat);
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => toggleInstructorCategory(cat)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 9999,
                        backgroundColor: isInstructor ? DesignColors.primary : DesignColors.inputBg,
                        borderWidth: 1,
                        borderColor: DesignColors.lightGreenBorder,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '500',
                          color: isInstructor ? '#FFF' : DesignColors.sageGreen,
                        }}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <Pressable
              onPress={() => setStep(2)}
              style={{
                marginTop: 24,
                paddingVertical: 14,
                borderRadius: 9999,
                backgroundColor: DesignColors.primary,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFF' }}>Next</Text>
            </Pressable>
          </>
        ) : (
          <>
            {error && (
              <View style={{ marginBottom: 16, padding: 12, backgroundColor: '#FEE2E2', borderRadius: 8 }}>
                <Text style={{ fontSize: 14, color: '#B91C1C' }}>{error}</Text>
              </View>
            )}
            {learnerCategories.length === 0 ? (
              <Text style={{ fontSize: 15, color: DesignColors.mediumGray, marginBottom: 24 }}>
                You didn’t select any learning interests. You can update this later in your profile.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                {learnerCategories.map((category) => (
                  <View key={category} style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.charcoal, marginBottom: 8 }}>
                      {category}
                    </Text>
                    <View style={{ gap: 8 }}>
                      {EXPERIENCE_OPTIONS.map((opt) => {
                        const isActive = experienceByCategory[category] === opt.value;
                        return (
                          <Pressable
                            key={opt.value}
                            onPress={() => setExperienceForCategory(category, opt.value)}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            style={{
                              paddingVertical: 12,
                              paddingHorizontal: 16,
                              borderRadius: 12,
                              backgroundColor: isActive ? DesignColors.primary : DesignColors.inputBg,
                              borderWidth: 1,
                              borderColor: DesignColors.lightGreenBorder,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: '500',
                                color: isActive ? '#FFF' : DesignColors.charcoal,
                              }}
                            >
                              {opt.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
            <Pressable
              onPress={handleComplete}
              disabled={!canComplete || loading}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              style={{
                marginTop: 24,
                paddingVertical: 14,
                borderRadius: 9999,
                backgroundColor: DesignColors.primary,
                alignItems: 'center',
                opacity: !canComplete || loading ? 0.6 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFF' }}>Complete</Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
