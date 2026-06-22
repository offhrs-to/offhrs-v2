import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { extractCanadianPostalFromAddress, parseCanadianPostalCode } from '@/lib/canadianPostalCode';
import { fetchRefundPolicyForEvent } from '@/lib/booking-cancel';
import { postLegacyBookTap, runPaidWorkshopBooking } from '@/lib/saas-booking-mobile';
import { provinceFromCanadianPostalCode } from '@/lib/workshop-booking-tax';
import { shareWorkshopEvent } from '@/lib/share-workshop';
import type { WorkshopEventRow } from '@/lib/workshops-events-query';
import {
  workshopDisplayPrice,
  workshopEventIsFull,
  workshopIsSaasVendorEvent,
} from '@/lib/workshop-event-utils';
import { vendorPagePath, workshopVendorDisplayName } from '@/lib/workshop-vendor-display';

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
  profilePostalCode?: string | null;
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
  profilePostalCode,
  onBookingComplete,
}: WorkshopQuickViewModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bookingBusy, setBookingBusy] = useState(false);
  const [refundWindowHours, setRefundWindowHours] = useState(48);

  // Tax is intentionally NOT calculated on modal open. Stripe Tax bills
  // per `tax.calculations.create` (~$0.05) and most modal opens never
  // convert to a booking. We defer the calculation to /api/book at the
  // moment the user actually proceeds to payment — Stripe's PaymentSheet
  // then shows the exact subtotal/tax/total breakdown before they confirm.
  // The refund-policy line is served by a separate, free DB endpoint.
  useEffect(() => {
    if (!visible || !event || !workshopIsSaasVendorEvent(event)) {
      setRefundWindowHours(48);
      return;
    }
    let cancelled = false;
    void fetchRefundPolicyForEvent(event.id).then((policy) => {
      if (!cancelled && policy?.refundWindowHours != null) {
        setRefundWindowHours(policy.refundWindowHours);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visible, event?.id]);

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
      const fromProfile = profilePostalCode?.trim()
        ? parseCanadianPostalCode(profilePostalCode)
        : null;
      const fromVenue = event.location?.trim()
        ? extractCanadianPostalFromAddress(event.location)
        : null;
      const normalized = fromProfile ?? fromVenue;
      const state = normalized ? provinceFromCanadianPostalCode(normalized) : null;
      if (!normalized || !state) {
        Alert.alert(
          'Postal code required',
          'Add a valid Canadian postal code in Profile (Settings), or book a workshop that lists a Canadian address, so we can calculate tax before you pay.',
          [{ text: 'OK' }, { text: 'Profile', onPress: () => router.push('/(tabs)/profile') }]
        );
        return;
      }
      setBookingBusy(true);
      try {
        const result = await runPaidWorkshopBooking({
          eventId: event.id,
          attendeeName: name,
          attendeeEmail: userEmail.trim(),
          startTimeIso: event.date_iso,
          customerAddress: { country: 'CA', postal_code: normalized, state },
        });
        if (result.ok) {
          // Close the modal FIRST so the alert appears over the underlying
          // screen, not over a modal that is mid-dismiss. Otherwise iOS can
          // leave the host tab in an unresponsive state after the alert is
          // tapped.
          onClose();
          onBookingComplete?.();
          // Small defer so the modal close animation has time to finish before
          // the alert presents on top of the underlying tab.
          setTimeout(() => {
            Alert.alert(
              'Booked',
              "You're signed up. Check your email for details.",
              [{ text: 'OK' }],
              { cancelable: true }
            );
          }, 200);
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
  }, [attendeeName, event, onBookingComplete, onClose, profilePostalCode, router, userEmail, userId]);

  const openVendorPage = useCallback(() => {
    if (!event) return;
    const path = vendorPagePath(event);
    if (!path) return;
    onClose();
    router.push(path);
  }, [event, onClose, router]);

  if (!event) return null;

  const priceLine = workshopDisplayPrice(event);
  const full = workshopEventIsFull(event);
  const saas = workshopIsSaasVendorEvent(event);
  const vendorName = workshopVendorDisplayName(event);
  const canOpenVendor = vendorPagePath(event) != null;
  const isFreeEvent = Number(event.price_cad ?? 0) <= 0;

  const distanceKm =
    profileLocation && event.lat != null && event.lng != null
      ? Math.round(haversineKm(profileLocation.lat, profileLocation.lng, Number(event.lat), Number(event.lng)) * 10) /
        10
      : null;

  // Android draws this transparent modal edge-to-edge (see `edgeToEdgeEnabled: true`
  // in app.json), so the sheet's top edge can graze the system status bar. Reserve
  // the status-bar height plus a little breathing room above the sheet on Android
  // only; iOS layout must stay exactly as-is.
  const sheetTopPadding = Platform.OS === 'android' ? insets.top + 12 : 0;
  const sheetTopRadius = 20;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingTop: sheetTopPadding }}>
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
            borderTopLeftRadius: sheetTopRadius,
            borderTopRightRadius: sheetTopRadius,
            overflow: 'hidden',
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            bounces={false}
            alwaysBounceVertical={false}
            overScrollMode="never"
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <View
              style={{
                width: '100%',
                aspectRatio: 4 / 3,
                backgroundColor: DesignColors.inputBg,
                position: 'relative',
                borderTopLeftRadius: sheetTopRadius,
                borderTopRightRadius: sheetTopRadius,
                overflow: 'hidden',
              }}
            >
              <Pressable
                onPress={canOpenVendor ? openVendorPage : undefined}
                disabled={!canOpenVendor}
                accessibilityRole={canOpenVendor ? 'button' : undefined}
                accessibilityLabel={
                  canOpenVendor && vendorName
                    ? `View ${vendorName} profile and reviews`
                    : undefined
                }
                style={{ width: '100%', height: '100%' }}
              >
                <CategoryFallbackImage
                  imageUrl={event.image_url}
                  category={event.category}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                  recyclingKey={`qv-${event.id}`}
                />
              </Pressable>
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
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                // Padding from the top of the image area (NOT the screen). The
                // modal sheet itself is already offset below the status bar by
                // sheetTopPadding on Android, so adding androidTopInset here
                // would push the icons into the middle of the image. Keep the
                // value platform-agnostic.
                paddingTop: 12,
                paddingLeft: 12,
                paddingRight: 12,
              }}
            >
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close workshop preview"
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
                <MaterialCommunityIcons name="close" size={24} color={DesignColors.charcoal} />
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8 }}>
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
            </View>

            <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
              <Pressable
                onPress={canOpenVendor ? openVendorPage : undefined}
                disabled={!canOpenVendor}
                accessibilityRole={canOpenVendor ? 'button' : undefined}
                accessibilityLabel={canOpenVendor ? `View workshop host for ${event.title}` : undefined}
              >
                <Text style={{ fontSize: 19, fontWeight: '700', color: DesignColors.charcoal }}>{event.title}</Text>
              </Pressable>
              {vendorName ? (
                <Pressable
                  onPress={canOpenVendor ? openVendorPage : undefined}
                  disabled={!canOpenVendor}
                  accessibilityRole={canOpenVendor ? 'button' : undefined}
                  accessibilityLabel={canOpenVendor ? `View ${vendorName} profile and reviews` : undefined}
                  style={{ marginTop: 4, alignSelf: 'flex-start' }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.primary }}>{vendorName}</Text>
                </Pressable>
              ) : null}
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
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: DesignColors.charcoal }}>
                      {priceLine}
                    </Text>
                    {saas && !isFreeEvent ? (
                      <Text style={{ fontSize: 12, color: DesignColors.mediumGray, marginTop: 2 }}>
                        Tax calculated at checkout
                      </Text>
                    ) : null}
                  </View>
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

              {saas ? (
                <Text style={{ marginTop: 12, fontSize: 12, color: DesignColors.mediumGray, lineHeight: 17 }}>
                  Free cancellation with full refund up to{' '}
                  <Text style={{ fontWeight: '600', color: DesignColors.charcoal }}>
                    {refundWindowHours} hours
                  </Text>{' '}
                  before the workshop starts.
                </Text>
              ) : null}
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
            {canOpenVendor ? (
              <Pressable
                onPress={openVendorPage}
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
                <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.primary }}>
                  {vendorName ? 'Reviews' : 'Vendor'}
                </Text>
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
