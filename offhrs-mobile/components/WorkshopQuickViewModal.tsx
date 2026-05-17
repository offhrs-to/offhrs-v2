import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CategoryFallbackImage from '@/components/CategoryFallbackImage';
import WorkshopDescriptionCollapsible from '@/components/WorkshopDescriptionCollapsible';
import { EventSaveHeartIcon } from '@/components/EventSaveHeartIcon';
import { DesignColors } from '@/constants/design-template';
import { haversineKm } from '@/lib/distance';
import { postLegacyBookTap, runPaidWorkshopBooking } from '@/lib/saas-booking-mobile';
import { shareWorkshopEvent } from '@/lib/share-workshop';
import type { WorkshopEventRow } from '@/lib/workshops-events-query';
import {
  workshopDisplayPrice,
  workshopEventIsFull,
  workshopIsSaasVendorEvent,
} from '@/lib/workshop-event-utils';

export type WorkshopQuickViewModalProps = {
  visible: boolean;
  event: WorkshopEventRow | null;
  onClose: () => void;
  userId: string | null | undefined;
  userEmail: string | null | undefined;
  attendeeName: string;
  saved: boolean;
  saving: boolean;
  onToggleSave: () => void;
  profileLocation: { lat: number; lng: number } | null;
  onBookingComplete?: () => void;
};

export default function WorkshopQuickViewModal({
  visible,
  event,
  onClose,
  userId,
  userEmail,
  attendeeName,
  saved,
  saving,
  onToggleSave,
  profileLocation,
  onBookingComplete,
}: WorkshopQuickViewModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bookingBusy, setBookingBusy] = useState(false);

  const handleBook = useCallback(async () => {
    if (!event) return;
    const full = workshopEventIsFull(event);
    if (full) return;

    const saas = workshopIsSaasVendorEvent(event);
    if (saas) {
      if (!userId) {
        Alert.alert('Sign in required', 'Create an account or sign in to book partner workshops in the app.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign in',
            onPress: () => {
              onClose();
              router.push('/login');
            },
          },
        ]);
        return;
      }
      if (!userEmail?.trim()) {
        Alert.alert('Email required', 'Add an email to your account before booking.');
        return;
      }
      const name = attendeeName.trim() || userEmail.split('@')[0] || 'Guest';
      setBookingBusy(true);
      try {
        const result = await runPaidWorkshopBooking({
          eventId: event.id,
          attendeeName: name,
          attendeeEmail: userEmail.trim(),
          startTimeIso: event.date_iso,
        });
        if (result.ok) {
          Alert.alert('Booked', "You're signed up. Check your email for details.");
          onBookingComplete?.();
          onClose();
        } else if (!result.cancelled) {
          Alert.alert('Booking', result.message);
        }
      } finally {
        setBookingBusy(false);
      }
      return;
    }

    await postLegacyBookTap(event.id, event.title);
    const url = event.external_link?.trim();
    if (url) {
      await Linking.openURL(url);
    } else {
      Alert.alert('No booking link', 'This listing does not have an external booking URL yet.');
    }
    onClose();
  }, [attendeeName, event, onBookingComplete, onClose, router, userEmail, userId]);

  if (!event) return null;

  const priceLine = workshopDisplayPrice(event);
  const full = workshopEventIsFull(event);
  const saas = workshopIsSaasVendorEvent(event);

  const distanceKm =
    profileLocation && event.lat != null && event.lng != null
      ? Math.round(haversineKm(profileLocation.lat, profileLocation.lng, Number(event.lat), Number(event.lng)) * 10) /
        10
      : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
          onPress={onClose}
        />
        <View
          style={{
            maxHeight: '92%',
            backgroundColor: '#FFF',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <View style={{ height: 200, width: '100%', backgroundColor: DesignColors.inputBg, position: 'relative' }}>
              <CategoryFallbackImage
                imageUrl={event.image_url}
                category={event.category}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                recyclingKey={`qv-${event.id}`}
              />
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 10,
                elevation: Platform.OS === 'android' ? 10 : undefined,
                direction: 'ltr',
                flexDirection: 'row',
                justifyContent: 'flex-end',
                alignItems: 'flex-start',
                paddingTop: 12,
                paddingRight: 12,
                gap: 8,
              }}
            >
              <Pressable
                onPress={() => void shareWorkshopEvent({ id: event.id, title: event.title })}
                accessibilityRole="button"
                accessibilityLabel="Share workshop"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                  elevation: Platform.OS === 'android' ? 4 : undefined,
                })}
              >
                <MaterialCommunityIcons name="share-variant" size={22} color={DesignColors.primary} />
              </Pressable>
              <Pressable
                onPress={onToggleSave}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={saved ? 'Remove from saved workshops' : 'Save workshop'}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                  elevation: Platform.OS === 'android' ? 4 : undefined,
                })}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={DesignColors.primary} />
                ) : (
                  <EventSaveHeartIcon saved={saved} size={26} />
                )}
              </Pressable>
            </View>
            </View>

            <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
              <Text style={{ fontSize: 19, fontWeight: '700', color: DesignColors.charcoal }}>{event.title}</Text>
              <Text style={{ marginTop: 8, fontSize: 14, color: DesignColors.mediumGray }}>{event.date}</Text>
              {event.location ? (
                <Text style={{ marginTop: 6, fontSize: 13, color: DesignColors.mediumGray }}>{event.location}</Text>
              ) : null}

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 10,
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                {priceLine != null ? (
                  <Text style={{ fontSize: 16, fontWeight: '600', color: DesignColors.charcoal }}>{priceLine}</Text>
                ) : (
                  <View />
                )}
                {distanceKm != null ? (
                  <Text style={{ fontSize: 13, color: DesignColors.mediumGray }}>{distanceKm} km away</Text>
                ) : null}
              </View>

              {full ? (
                <View
                  style={{
                    marginTop: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: 'rgba(0,0,0,0.06)',
                    borderWidth: 1,
                    borderColor: 'rgba(0,0,0,0.08)',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: DesignColors.mediumGray }}>
                    Full capacity
                  </Text>
                  <Text style={{ marginTop: 4, fontSize: 12, color: DesignColors.mediumGray, lineHeight: 17 }}>
                    This session has no spots left. Try another time or workshop.
                  </Text>
                </View>
              ) : null}

              <WorkshopDescriptionCollapsible description={event.description} />

              <Text style={{ marginTop: 14, fontSize: 11, color: DesignColors.mediumGray, lineHeight: 16 }}>
                {saas
                  ? 'Paid bookings are processed securely by Stripe. You may pay with card, Apple Pay, or Google Pay when available on your device.'
                  : "You'll open the host's site. Their price, availability, and terms apply."}
              </Text>
            </View>
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              paddingHorizontal: 16,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: '#E8E4DE',
            }}
          >
            {event.vendor_id ? (
              <Pressable
                onPress={() => {
                  onClose();
                  router.push(`/vendors/${event.vendor_id}`);
                }}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: DesignColors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.primary }}>Vendor</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => void handleBook()}
              disabled={full || bookingBusy}
              accessibilityState={{ disabled: full || bookingBusy }}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: full || bookingBusy ? '#B8C4B8' : DesignColors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {bookingBusy ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFF' }}>
                  {full ? 'Full' : saas ? 'Book' : 'Book on site'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
