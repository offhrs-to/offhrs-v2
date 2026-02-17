import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View, Text } from 'react-native';

import { DesignColors } from '@/constants/design-template';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export interface Event {
  id: number;
  title: string;
  date: string;
  location: string;
  image_url: string | null;
  price?: number | string | null;
  external_link: string;
  vendor_id?: string | null;
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
export const CARD_TOTAL_HEIGHT = CARD_IMAGE_HEIGHT + CARD_BODY_HEIGHT;

/** Height reserved at bottom of card body for Vendor/Book buttons so they align across all cards */
const CARD_BUTTONS_HEIGHT = 40;

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
  const displayPrice = formatPrice(event.price);
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
    if (displaySaved) {
      const { error } = await supabase
        .from('user_event_saves')
        .delete()
        .eq('user_id', user.id)
        .eq('event_id', event.id);
      if (!error) {
        if (onSaveChange) onSaveChange(event.id, false);
        else setInternalSaved(false);
      }
    } else {
      const { error } = await supabase
        .from('user_event_saves')
        .insert({ user_id: user.id, event_id: event.id });
      if (!error) {
        if (onSaveChange) onSaveChange(event.id, true);
        else setInternalSaved(true);
      }
    }
    setSaving(false);
  };

  const handleBook = async () => {
    if (user?.id) {
      const apiUrl = process.env.EXPO_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          await fetch(`${apiUrl}/api/book`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ event_id: event.id, event_title: event.title }),
          });
        }
      } catch {}
    }
    const url = event.external_link?.trim();
    if (url) Linking.openURL(url);
  };

  const cardContent = (
    <>
      <View style={{ height: CARD_IMAGE_HEIGHT, width: '100%', overflow: 'hidden', borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#F5F5F5' }}>
        {event.image_url ? (
          <Image
            source={{ uri: event.image_url }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        ) : (
          <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: DesignColors.mediumGray, fontSize: 11 }}>No image</Text>
          </View>
        )}
      </View>
      <View
        style={{
          height: CARD_BODY_HEIGHT,
          backgroundColor: '#FFF',
          padding: 12,
          paddingBottom: 12 + CARD_BUTTONS_HEIGHT,
          position: 'relative',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexShrink: 0 }}>
          <Text
            style={{ fontSize: 13, fontWeight: '700', color: DesignColors.charcoal }}
            numberOfLines={2}
          >
            {event.title}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 11, color: DesignColors.mediumGray }} numberOfLines={1}>
            {event.date}
          </Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', minHeight: 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            {displayPrice != null ? (
              <Text style={{ fontSize: 12, fontWeight: '600', color: DesignColors.charcoal }}>
                {displayPrice}
              </Text>
            ) : (
              <View />
            )}
            {distanceKm != null ? (
              <Text style={{ fontSize: 11, color: DesignColors.mediumGray }}>
                {distanceKm} km
              </Text>
            ) : null}
          </View>
        </View>
        <View
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            right: 12,
            flexDirection: 'row',
            gap: 6,
          }}
        >
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
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: DesignColors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFF' }}>Book</Text>
          </Pressable>
        </View>
      </View>
    </>
  );

  const wrapperStyle = [
    softShadow,
    { overflow: 'hidden', borderRadius: 20, backgroundColor: '#FFF', height: CARD_TOTAL_HEIGHT },
  ];

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={wrapperStyle}>
        {cardContent}
      </Pressable>
    );
  }

  return <View style={wrapperStyle}>{cardContent}</View>;
}
