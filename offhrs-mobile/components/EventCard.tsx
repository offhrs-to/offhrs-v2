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
  onPress?: () => void;
}

export const CARD_IMAGE_HEIGHT = 140;
export const CARD_BODY_HEIGHT = 132;
export const CARD_TOTAL_HEIGHT = CARD_IMAGE_HEIGHT + CARD_BODY_HEIGHT;

const softShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.04,
  shadowRadius: 30,
  elevation: 4,
};

export function EventCard({ event, onPress }: EventCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const displayPrice = formatPrice(event.price);

  useEffect(() => {
    if (!user?.id || !event.vendor_id) return;
    supabase
      .from('user_vendor_saves')
      .select('id')
      .eq('user_id', user.id)
      .eq('vendor_id', event.vendor_id)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data));
  }, [user?.id, event.vendor_id]);

  const handleSave = async () => {
    if (!user || !event.vendor_id || saving) return;
    setSaving(true);
    if (saved) {
      await supabase
        .from('user_vendor_saves')
        .delete()
        .eq('user_id', user.id)
        .eq('vendor_id', event.vendor_id);
      setSaved(false);
    } else {
      await supabase
        .from('user_vendor_saves')
        .insert({ user_id: user.id, vendor_id: event.vendor_id });
      setSaved(true);
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
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text
            style={{ fontSize: 13, fontWeight: '700', color: DesignColors.charcoal }}
            numberOfLines={2}
          >
            {event.title}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 11, color: DesignColors.mediumGray }} numberOfLines={1}>
            {event.date}
          </Text>
          {displayPrice != null && (
            <Text style={{ marginTop: 6, fontSize: 12, fontWeight: '600', color: DesignColors.charcoal }}>
              {displayPrice}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
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
