import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { ActivityIndicator, Alert, Platform, Pressable, View, Text } from 'react-native';

import CategoryFallbackImage from '@/components/CategoryFallbackImage';
import { DesignColors } from '@/constants/design-template';
import { EventSaveHeartIcon } from '@/components/EventSaveHeartIcon';
import { useAuth } from '@/contexts/AuthContext';
import { postLegacyBookTap, runPaidWorkshopBooking } from '@/lib/saas-booking-mobile';
import { supabase } from '@/lib/supabase';
import { workshopDisplayPrice, workshopEventIsFull, workshopIsSaasVendorEvent } from '@/lib/workshop-event-utils';

export interface Event {
  id: number;
  title: string;
  date: string;
  location: string;
  image_url: string | null;
  price?: number | string | null;
  /** SaaS listing price (CAD) when `vendor_profile_id` is set. */
  price_cad?: number | null;
  external_link: string;
  vendor_id?: string | null;
  vendor_profile_id?: string | null;
  booking_status?: string | null;
  available_slots?: number | null;
  /** ISO start time for SaaS slot (optional). */
  date_iso?: string | null;
  /** Used for Master-tier placeholder when image is missing or fails to load. */
  category?: string | null;
}

function formatPrice(price: number | string | null | undefined): string | null {
  if (price == null) return null;
  const s = typeof price === 'string' ? price.replace(/^\$/, '').trim() : String(price);
  if (s === '' || isNaN(Number(s))) return null;
  return `$${s}`;
}

interface EventCardProps {
  event: Event;
  /** Distance in km from user's address (e.g. from home search); shown to the right of price when set. */
  distanceKm?: number;
  onPress?: () => void;
  /** When provided (e.g. from workshops list), card is controlled and this reflects saved state. */
  saved?: boolean;
  /** Called after a successful save/unsave when card is controlled. */
  onSaveChange?: (eventId: number, saved: boolean) => void;
}

export const CARD_IMAGE_HEIGHT = 140;
export const CARD_BODY_HEIGHT = 132;
/** Slightly taller body on Android so Vendor/Book buttons are not clipped (e.g. by density/font scaling). */
const CARD_BODY_HEIGHT_ANDROID = 148;
export const CARD_TOTAL_HEIGHT = CARD_IMAGE_HEIGHT + CARD_BODY_HEIGHT;
export const CARD_TOTAL_HEIGHT_ANDROID = CARD_IMAGE_HEIGHT + CARD_BODY_HEIGHT_ANDROID;

/** Height reserved at bottom of card body for Vendor/Book buttons so they align across all cards */
const CARD_BUTTONS_HEIGHT = 40;
/** Action row: gap above buttons + button height + bottom padding (must match split when card has `onPress`). */
const CARD_ACTION_ROW_HEIGHT = 4 + CARD_BUTTONS_HEIGHT + 12;

const cardBodyHeight = Platform.OS === 'android' ? CARD_BODY_HEIGHT_ANDROID : CARD_BODY_HEIGHT;
const cardTotalHeight = CARD_IMAGE_HEIGHT + cardBodyHeight;

const softShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.04,
  shadowRadius: 30,
  elevation: 4,
};

export function EventCard({ event, distanceKm, onPress, saved: savedProp, onSaveChange }: EventCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [internalSaved, setInternalSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const displayPrice =
    workshopIsSaasVendorEvent(event) ? workshopDisplayPrice(event) : formatPrice(event.price);
  const isFull = workshopEventIsFull(event);
  const isControlled = savedProp !== undefined;
  const displaySaved = isControlled ? savedProp : internalSaved;

  useEffect(() => {
    if (isControlled || !user?.id || event.id == null) return;
    supabase
      .from('user_event_saves')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_id', event.id)
      .maybeSingle()
      .then(({ data }) => setInternalSaved(!!data));
  }, [user?.id, event.id, isControlled]);

  const handleSave = async () => {
    if (!user || event.id == null || saving) return;
    setSaving(true);
    try {
      if (displaySaved) {
        const { error } = await supabase
          .from('user_event_saves')
          .delete()
          .eq('user_id', user.id)
          .eq('event_id', event.id);
        if (error) {
          Alert.alert("Couldn't update", error.message ?? 'Please try again.');
          return;
        }
        if (onSaveChange) onSaveChange(event.id, false);
        else setInternalSaved(false);
      } else {
        const { error } = await supabase
          .from('user_event_saves')
          .insert({ user_id: user.id, event_id: event.id });
        if (error) {
          Alert.alert("Couldn't save", error.message ?? 'Please try again.');
          return;
        }
        if (onSaveChange) onSaveChange(event.id, true);
        else setInternalSaved(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const onHeartPress = () => {
    if (!user) {
      router.push('/login');
      return;
    }
    void handleSave();
  };

  const handleBook = async () => {
    if (isFull) return;
    if (workshopIsSaasVendorEvent(event)) {
      if (!user?.id) {
        router.push('/login');
        return;
      }
      if (!user.email?.trim()) {
        Alert.alert('Email required', 'Add an email to your account before booking.');
        return;
      }
      const name =
        (user.user_metadata?.full_name as string | undefined)?.trim() ||
        user.email.split('@')[0] ||
        'Guest';
      setBookingBusy(true);
      try {
        const result = await runPaidWorkshopBooking({
          eventId: event.id,
          attendeeName: name,
          attendeeEmail: user.email,
          startTimeIso: event.date_iso,
        });
        if (result.ok) {
          Alert.alert('Booked', "You're signed up. Check your email for details.");
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
    if (url) Linking.openURL(url);
  };

  const imageBlock = (
    <View style={{ height: CARD_IMAGE_HEIGHT, width: '100%', overflow: 'hidden', borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#F5F5F5' }}>
      <CategoryFallbackImage
        imageUrl={event.image_url}
        category={event.category}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        recyclingKey={`card-${event.id}`}
      />
    </View>
  );

  const titleDatePrice = (
    <>
      <View style={{ flexShrink: 0 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: DesignColors.charcoal }} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={{ marginTop: 4, fontSize: 11, color: DesignColors.mediumGray }} numberOfLines={1}>
          {event.date}
        </Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', minHeight: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {displayPrice != null ? (
            <Text style={{ fontSize: 12, fontWeight: '600', color: DesignColors.charcoal }}>{displayPrice}</Text>
          ) : (
            <View />
          )}
          {distanceKm != null ? (
            <Text style={{ fontSize: 11, color: DesignColors.mediumGray }}>{distanceKm} km</Text>
          ) : null}
        </View>
      </View>
    </>
  );

  const actionButtons = (
    <>
      <Pressable
        onPress={onHeartPress}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={displaySaved ? 'Remove from saved workshops' : 'Save workshop'}
        style={{
          width: 40,
          height: 36,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: DesignColors.lightGreenBorder,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFF',
        }}
      >
        {saving ? (
          <ActivityIndicator size="small" color={DesignColors.primary} />
        ) : (
          <EventSaveHeartIcon saved={displaySaved} size={22} />
        )}
      </Pressable>
      {event.vendor_id && (
        <Pressable
          onPress={() => router.push(`/vendors/${event.vendor_id}`)}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: DesignColors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '600', color: DesignColors.primary }}>
            Vendor
          </Text>
        </Pressable>
      )}
      <Pressable
        onPress={handleBook}
        disabled={bookingBusy || isFull}
        accessibilityState={{ disabled: bookingBusy || isFull }}
        style={{
          flex: 1,
          paddingVertical: 8,
          borderRadius: 10,
          backgroundColor: isFull ? '#B8C4B8' : DesignColors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {bookingBusy ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFF' }}>{isFull ? 'Full' : 'Book'}</Text>
        )}
      </Pressable>
    </>
  );

  const tappableBodyHeight = cardBodyHeight - CARD_ACTION_ROW_HEIGHT;

  const wrapperStyle: ViewStyle[] = [
    softShadow,
    {
      overflow: 'hidden',
      borderRadius: 20,
      backgroundColor: '#FFF',
      height: cardTotalHeight,
      opacity: isFull ? 0.55 : 1,
    },
  ];

  if (onPress) {
    return (
      <View style={wrapperStyle}>
        <Pressable
          onPress={isFull ? undefined : onPress}
          disabled={isFull}
          style={{ height: CARD_IMAGE_HEIGHT + tappableBodyHeight, width: '100%' }}
        >
          {imageBlock}
          <View
            style={{
              height: tappableBodyHeight,
              backgroundColor: '#FFF',
              paddingHorizontal: 12,
              paddingTop: 12,
              paddingBottom: 8,
            }}
          >
            {titleDatePrice}
          </View>
        </Pressable>
        <View
          style={{
            height: CARD_ACTION_ROW_HEIGHT,
            backgroundColor: '#FFF',
            paddingTop: 4,
            paddingBottom: 12,
            paddingHorizontal: 12,
            flexDirection: 'row',
            gap: 6,
            alignItems: 'center',
          }}
        >
          {actionButtons}
        </View>
      </View>
    );
  }

  const cardContent = (
    <>
      {imageBlock}
      <View
        style={{
          height: cardBodyHeight,
          backgroundColor: '#FFF',
          padding: 12,
          paddingBottom: 12 + CARD_BUTTONS_HEIGHT,
          position: 'relative',
          justifyContent: 'space-between',
        }}
      >
        {titleDatePrice}
        <View
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            right: 12,
            flexDirection: 'row',
            gap: 6,
            alignItems: 'center',
          }}
        >
          {actionButtons}
        </View>
      </View>
    </>
  );

  return <View style={wrapperStyle}>{cardContent}</View>;
}
