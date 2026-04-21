import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import { CATEGORIES } from '@/constants/categories';
import { DesignColors } from '@/constants/design-template';
import { parseCanadianPostalCode } from '@/lib/canadianPostalCode';
import { geocodeAddress, reverseGeocodeCanadianPostal } from '@/lib/geocode';

// Points align with level progression: each level = 8 pts (Novice 0, Intermediate 8, Advanced 16, Expert 24, Master 32)
const EXPERIENCE_OPTIONS = [
  { value: 'no_experience', label: 'No experience', level: 'Novice', points: 0 },
  { value: '0-1', label: '0-1 year', level: 'Novice', points: 0 },
  { value: '2-3', label: '2-3 years', level: 'Intermediate', points: 8 },
  { value: '3-5', label: '3-5 years', level: 'Advanced', points: 16 },
  { value: '5-10', label: '5-10 years', level: 'Expert', points: 24 },
  { value: '10+', label: '10+ years', level: 'Master', points: 32 },
] as const;

type PendingLocation = {
  postal_code: string | null;
  lat: number;
  lng: number;
};

export default function OnboardingModal({
  userId,
  onComplete,
}: {
  userId: string;
  onComplete: () => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const step1ChipMetrics = useMemo(
    () =>
      Platform.OS === 'android'
        ? { padH: 12, padV: 8, font: 13, gap: 8, scrollMax: Math.min(480, Math.round(windowHeight * 0.55)) }
        : { padH: 16, padV: 10, font: 14, gap: 10, scrollMax: 360 },
    [windowHeight]
  );

  const [step, setStep] = useState(0);
  const [experienceCategoryIndex, setExperienceCategoryIndex] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [instructorCategories, setInstructorCategories] = useState<string[]>([]);
  /** Per-category experience (only for categories they're learning, not instructing). */
  const [experienceByCategory, setExperienceByCategory] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [postalBusy, setPostalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postalInput, setPostalInput] = useState('');
  const [pendingLocation, setPendingLocation] = useState<PendingLocation | null>(null);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleInstructorCategory = (cat: string) => {
    setInstructorCategories((prev) => {
      const next = prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat];
      if (!prev.includes(cat)) {
        setSelectedCategories((s) => s.filter((c) => c !== cat));
      }
      return next;
    });
  };

  /** Categories selected for learning (not instructor-only). */
  const learnerCategories = selectedCategories.filter((c) => !instructorCategories.includes(c));

  const setExperienceForCategory = (category: string, value: string) => {
    setExperienceByCategory((prev) => ({ ...prev, [category]: value }));
  };

  const currentExperienceCategory = learnerCategories[experienceCategoryIndex] ?? null;
  const hasSelectionForCurrent = currentExperienceCategory
    ? experienceByCategory[currentExperienceCategory] != null && experienceByCategory[currentExperienceCategory] !== ''
    : true;
  const isLastExperienceCategory =
    learnerCategories.length === 0 || experienceCategoryIndex >= learnerCategories.length - 1;
  const canComplete =
    learnerCategories.length === 0 ||
    learnerCategories.every((cat) => experienceByCategory[cat] != null && experienceByCategory[cat] !== '');
  const canGoNext = hasSelectionForCurrent && !isLastExperienceCategory;

  const handleUseMyLocation = async () => {
    setError(null);
    setGpsBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location off',
          'You can enter a Canadian postal code below instead, or enable location in system settings.'
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const postal = await reverseGeocodeCanadianPostal(lat, lng);
      setPostalInput('');
      setPendingLocation({ postal_code: postal, lat, lng });
    } catch (err: unknown) {
      console.warn('Location error', err);
      Alert.alert('Could not get location', 'Try again or enter your postal code.');
    } finally {
      setGpsBusy(false);
    }
  };

  const goFromLocationStep = async () => {
    setError(null);
    const trimmed = postalInput.trim();
    if (trimmed) {
      setPostalBusy(true);
      try {
        const norm = parseCanadianPostalCode(trimmed);
        if (!norm) {
          Alert.alert('Invalid postal code', 'Use Canadian format, e.g. A1A 1A1.');
          return;
        }
        const coords = await geocodeAddress(`${norm}, Canada`);
        if (!coords) {
          Alert.alert('Not found', 'We could not find that postal code. Check and try again.');
          return;
        }
        setPendingLocation({ postal_code: norm, lat: coords.lat, lng: coords.lng });
      } finally {
        setPostalBusy(false);
      }
    }
    setExperienceCategoryIndex(0);
    setStep(1);
  };

  const locationStepBusy = gpsBusy || postalBusy;

  const skipLocation = () => {
    setPendingLocation(null);
    setPostalInput('');
    setExperienceCategoryIndex(0);
    setStep(1);
  };

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
        postal_code: pendingLocation?.postal_code ?? null,
        location_lat: pendingLocation != null ? pendingLocation.lat : null,
        location_lng: pendingLocation != null ? pendingLocation.lng : null,
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

      // Android: PostgREST returns HTTP 200 even when RLS blocks a write (0 rows affected).
      // Verify the row actually has onboarding_completed = true. If not, refresh the session
      // and retry once, then verify again. A clear error is thrown if both attempts fail so
      // the user sees a retry prompt rather than silent data loss.
      if (Platform.OS === 'android') {
        const { data: check1 } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', userId)
          .single();

        if (!check1?.onboarding_completed) {
          await supabase.auth.refreshSession();
          const { error: retryError } = await supabase.from('profiles').upsert(
            { ...profilePayload, expertise_level: defaultLevel, experience_points: defaultPoints },
            { onConflict: 'id' }
          );
          if (retryError) throw retryError;

          // Verify the retry actually committed — PostgREST can return 200 with 0 rows.
          const { data: check2 } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', userId)
            .single();

          if (!check2?.onboarding_completed) {
            throw new Error('Could not save your onboarding info. Please check your connection and try again.');
          }
        }
      }

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
          },
          { onConflict: 'user_id,category' }
        );
        // Non-fatal: onboarding_completed is already committed in profiles.
        // Category preferences can be updated anytime in profile settings.
        if (rowError) {
          console.error('Onboarding: category experience row error (non-fatal):', rowError);
        }
      }

      onComplete();
    } catch (err: unknown) {
      const raw = err as { message?: string; details?: string; hint?: string };
      const message =
        raw?.message ?? (err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      const detail = raw?.details || raw?.hint ? ` (${raw.details || ''} ${raw.hint || ''})`.trim() : '';
      setError(message);
      console.error('Onboarding error:', err);
      Alert.alert('Couldn’t save', message + detail);
    } finally {
      setLoading(false);
    }
  };

  const headerTitle =
    step === 0
      ? 'Find workshops near you'
      : step === 1
        ? 'What sparks your curiosity?'
        : "What's your experience level?";
  const headerSubtitle =
    step === 0
      ? 'Optional: we use this to sort workshops by distance. You can add or change it anytime in Settings.'
      : step === 1
        ? 'Select interests and optionally mark categories where you teach'
        : "We'll use this to personalize your experience";

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
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
          {headerTitle}
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: DesignColors.mediumGray,
            marginBottom: 24,
          }}
        >
          {headerSubtitle}
        </Text>

        {step === 0 ? (
          <>
            {pendingLocation && (
              <View
                style={{
                  marginBottom: 16,
                  padding: 12,
                  backgroundColor: DesignColors.inputBg,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: DesignColors.lightGreenBorder,
                }}
              >
                <Text style={{ fontSize: 14, color: DesignColors.charcoal, fontWeight: '600' }}>
                  {pendingLocation.postal_code
                    ? `Using ${pendingLocation.postal_code}`
                    : 'Using your current location'}
                </Text>
                <Text style={{ fontSize: 12, color: DesignColors.mediumGray, marginTop: 4 }}>
                  Workshops will be sorted closest first.
                </Text>
              </View>
            )}
            <Pressable
              onPress={handleUseMyLocation}
              disabled={locationStepBusy}
              style={{
                paddingVertical: 14,
                borderRadius: 9999,
                backgroundColor: DesignColors.primary,
                alignItems: 'center',
                opacity: locationStepBusy ? 0.7 : 1,
                marginBottom: 20,
              }}
            >
              {gpsBusy ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFF' }}>Use my location</Text>
              )}
            </Pressable>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: DesignColors.charcoal,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              or enter postal code
            </Text>
            <TextInput
              value={postalInput}
              onChangeText={setPostalInput}
              placeholder="A1A 1A1"
              placeholderTextColor={DesignColors.mediumGray}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              style={{
                backgroundColor: DesignColors.inputBg,
                borderWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                color: DesignColors.charcoal,
                marginBottom: 16,
              }}
            />
            <Text style={{ fontSize: 12, color: DesignColors.mediumGray, marginBottom: 16 }}>
              Canadian format only (letter-digit-letter digit-letter-digit). Optional — you can skip.
            </Text>
            <Pressable
              onPress={goFromLocationStep}
              disabled={locationStepBusy}
              style={{
                paddingVertical: 14,
                borderRadius: 9999,
                backgroundColor: DesignColors.primary,
                alignItems: 'center',
                opacity: locationStepBusy ? 0.7 : 1,
                marginBottom: 12,
              }}
            >
              {postalBusy ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFF' }}>Next</Text>
              )}
            </Pressable>
            <Pressable onPress={skipLocation} disabled={locationStepBusy} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: DesignColors.sageGreen }}>Skip for now</Text>
            </Pressable>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <ScrollView
              style={{ maxHeight: step1ChipMetrics.scrollMax }}
              contentContainerStyle={Platform.OS === 'android' ? { paddingBottom: 12 } : undefined}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={Platform.OS === 'android'}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.charcoal, marginBottom: 8 }}>
                What sparks your curiosity?
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: step1ChipMetrics.gap,
                  marginBottom: 20,
                }}
              >
                {CATEGORIES.map((cat) => {
                  const isInstructor = instructorCategories.includes(cat);
                  const isActive = selectedCategories.includes(cat);
                  const disabled = isInstructor;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => !disabled && toggleCategory(cat)}
                      disabled={disabled}
                      style={{
                        paddingHorizontal: step1ChipMetrics.padH,
                        paddingVertical: step1ChipMetrics.padV,
                        borderRadius: 9999,
                        backgroundColor: disabled ? '#E5E7EB' : isActive ? DesignColors.primary : DesignColors.inputBg,
                        borderWidth: 1,
                        borderColor: disabled ? '#D1D5DB' : DesignColors.lightGreenBorder,
                        opacity: disabled ? 0.7 : 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: step1ChipMetrics.font,
                          fontWeight: '500',
                          color: disabled ? '#9CA3AF' : isActive ? '#FFF' : DesignColors.sageGreen,
                        }}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.charcoal, marginBottom: 8 }}>
                I&apos;m an Instructor in (optional)
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: step1ChipMetrics.gap }}>
                {CATEGORIES.map((cat) => {
                  const isInstructor = instructorCategories.includes(cat);
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => toggleInstructorCategory(cat)}
                      style={{
                        paddingHorizontal: step1ChipMetrics.padH,
                        paddingVertical: step1ChipMetrics.padV,
                        borderRadius: 9999,
                        backgroundColor: isInstructor ? DesignColors.primary : DesignColors.inputBg,
                        borderWidth: 1,
                        borderColor: DesignColors.lightGreenBorder,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: step1ChipMetrics.font,
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
              onPress={() => {
                setExperienceCategoryIndex(0);
                setStep(2);
              }}
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
        ) : null}

        {step === 2 ? (
          <>
            {error && (
              <View style={{ marginBottom: 16, padding: 12, backgroundColor: '#FEE2E2', borderRadius: 8 }}>
                <Text style={{ fontSize: 14, color: '#B91C1C' }}>{error}</Text>
              </View>
            )}
            {learnerCategories.length === 0 ? (
              <Text style={{ fontSize: 15, color: DesignColors.mediumGray, marginBottom: 24 }}>
                You didn&apos;t select any learning interests. You can update this later in your profile.
              </Text>
            ) : currentExperienceCategory ? (
              <>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: DesignColors.mediumGray,
                    marginBottom: 4,
                  }}
                >
                  {experienceCategoryIndex + 1} of {learnerCategories.length}
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: DesignColors.charcoal,
                    marginBottom: 16,
                  }}
                >
                  What&apos;s your experience level for {currentExperienceCategory}?
                </Text>
                <View style={{ gap: 8 }}>
                  {EXPERIENCE_OPTIONS.map((opt) => {
                    const isActive = experienceByCategory[currentExperienceCategory] === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setExperienceForCategory(currentExperienceCategory, opt.value)}
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
              </>
            ) : null}
            {learnerCategories.length > 0 && (
              <Pressable
                onPress={() => {
                  if (isLastExperienceCategory) handleComplete();
                  else if (canGoNext) setExperienceCategoryIndex((i) => i + 1);
                }}
                disabled={
                  isLastExperienceCategory ? !canComplete || loading : !hasSelectionForCurrent
                }
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                style={{
                  marginTop: 24,
                  paddingVertical: 14,
                  borderRadius: 9999,
                  backgroundColor: DesignColors.primary,
                  alignItems: 'center',
                  opacity:
                    isLastExperienceCategory
                      ? canComplete && !loading ? 1 : 0.6
                      : hasSelectionForCurrent ? 1 : 0.6,
                }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFF' }}>
                    {isLastExperienceCategory ? 'Complete' : 'Next'}
                  </Text>
                )}
              </Pressable>
            )}
            {learnerCategories.length === 0 && (
              <Pressable
                onPress={handleComplete}
                disabled={loading}
                style={{
                  marginTop: 24,
                  paddingVertical: 14,
                  borderRadius: 9999,
                  backgroundColor: DesignColors.primary,
                  alignItems: 'center',
                }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFF' }}>Complete</Text>
                )}
              </Pressable>
            )}
          </>
        ) : null}
        </View>
      </View>
    </Modal>
  );
}
