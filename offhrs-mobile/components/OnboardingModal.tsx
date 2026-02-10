import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
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
  const [experience, setExperience] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const handleComplete = async () => {
    if (!experience) return;
    setLoading(true);
    try {
      const option = EXPERIENCE_OPTIONS.find((o) => o.value === experience);
      const { error } = await supabase
        .from('profiles')
        .update({
          category_of_interest: selectedCategories.length > 0 ? selectedCategories : null,
          instructor_categories: instructorCategories.length > 0 ? instructorCategories : null,
          is_instructor: instructorCategories.length > 0,
          years_experience: experience,
          expertise_level: option?.level ?? 'Novice',
          experience_points: option?.points ?? 0,
          onboarding_completed: true,
        })
        .eq('id', userId);

      if (error) throw error;
      onComplete();
    } catch (err) {
      console.error('Onboarding error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
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
            {EXPERIENCE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setExperience(opt.value)}
                style={{
                  marginBottom: 10,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: experience === opt.value ? DesignColors.primary : DesignColors.inputBg,
                  borderWidth: 1,
                  borderColor: DesignColors.lightGreenBorder,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '500',
                    color: experience === opt.value ? '#FFF' : DesignColors.charcoal,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={handleComplete}
              disabled={!experience || loading}
              style={{
                marginTop: 24,
                paddingVertical: 14,
                borderRadius: 9999,
                backgroundColor: DesignColors.primary,
                alignItems: 'center',
                opacity: !experience || loading ? 0.6 : 1,
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
