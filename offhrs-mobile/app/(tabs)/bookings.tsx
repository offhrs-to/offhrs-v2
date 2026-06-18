import WorkshopQuickViewModal from '@/components/WorkshopQuickViewModal';
import {
  DesignColors,
  DesignSizes,
  DesignSpacing,
} from '@/constants/design-template';
import { useAuth } from '@/contexts/AuthContext';
import { BOOK_API_BASE } from '@/constants/api';
import { cancelUserBooking } from '@/lib/booking-cancel';
import { buildBookingApiHeaders } from '@/lib/booking-api-headers';
import { fetchUserBookings, type UserBookingListItem } from '@/lib/user-bookings-query';
import type { WorkshopEventRow } from '@/lib/workshops-events-query';
import { supabase } from '@/lib/supabase';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

const STATUS_COLORS: Record<
  UserBookingListItem['statusKind'],
  { bg: string; text: string }
> = {
  confirmed: { bg: '#E8F0E5', text: DesignColors.primary },
  past: { bg: 'rgba(0,0,0,0.06)', text: DesignColors.mediumGray },
  refunded: { bg: '#FEF3C7', text: '#B45309' },
  pending: { bg: '#E0E7FF', text: '#4338CA' },
};

function BookingListRow({
  item,
  onPress,
  onCancel,
  cancelBusy,
}: {
  item: UserBookingListItem;
  onPress: () => void;
  onCancel?: () => void;
  cancelBusy?: boolean;
}) {
  const colors = STATUS_COLORS[item.statusKind];
  const showCancel = item.canRequestRefund || item.cancelBlockedMessage;
  return (
    <View
      style={{
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.08)',
      }}
    >
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <Text
          style={{ flex: 1, fontSize: 16, fontWeight: '600', color: DesignColors.charcoal }}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
            backgroundColor: colors.bg,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>{item.statusLabel}</Text>
        </View>
      </View>
      <Text style={{ marginTop: 6, fontSize: 14, color: DesignColors.charcoal }}>{item.dateLine}</Text>
      {item.timeDurationLine ? (
        <Text style={{ marginTop: 2, fontSize: 13, color: DesignColors.mediumGray }}>
          {item.timeDurationLine}
        </Text>
      ) : null}
      <Text style={{ marginTop: 4, fontSize: 13, color: DesignColors.mediumGray }} numberOfLines={2}>
        {item.location}
      </Text>
    </Pressable>
    {showCancel ? (
      <View style={{ marginTop: 10 }}>
        {item.canRequestRefund && onCancel ? (
          <Pressable
            onPress={onCancel}
            disabled={cancelBusy}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#DC2626',
              opacity: pressed || cancelBusy ? 0.7 : 1,
            })}
          >
            {cancelBusy ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#DC2626' }}>
                Cancel & request refund
              </Text>
            )}
          </Pressable>
        ) : item.cancelBlockedMessage ? (
          <Text style={{ fontSize: 12, color: DesignColors.mediumGray, lineHeight: 17 }}>
            {item.cancelBlockedMessage}
          </Text>
        ) : null}
      </View>
    ) : null}
    </View>
  );
}

export default function BookingsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<UserBookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [quickViewEvent, setQuickViewEvent] = useState<WorkshopEventRow | null>(null);
  const [savedEventIds, setSavedEventIds] = useState<Set<number>>(new Set());
  const [quickViewSaving, setQuickViewSaving] = useState(false);
  const [profileLocation, setProfileLocation] = useState<{
    lat: number;
    lng: number;
    postal_code: string | null;
  } | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    const list = await fetchUserBookings(user.id, user.email);
    setItems(list);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id, user?.email]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadBookings();

      if (!user?.id) return;

      void (async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const headers = await buildBookingApiHeaders(token);
        await fetch(`${BOOK_API_BASE}/api/attendance/credit-due`, {
          method: 'POST',
          headers,
        }).catch(() => {});
        void loadBookings();
      })();

      supabase
        .from('user_event_saves')
        .select('event_id')
        .eq('user_id', user.id)
        .then(({ data }) => {
          setSavedEventIds(new Set((data ?? []).map((r) => Number(r.event_id))));
        });

      supabase
        .from('profiles')
        .select('location_lat, location_lng, postal_code, display_name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setProfileDisplayName(data?.display_name?.trim() || null);
          if (data?.location_lat != null && data?.location_lng != null) {
            setProfileLocation({
              lat: Number(data.location_lat),
              lng: Number(data.location_lng),
              postal_code: data.postal_code ?? null,
            });
          } else {
            setProfileLocation(null);
          }
        });
    }, [user?.id, loadBookings])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadBookings();
  }, [loadBookings]);

  const eventIdNum = quickViewEvent?.id != null ? Number(quickViewEvent.id) : null;
  const quickViewSaved = eventIdNum != null && savedEventIds.has(eventIdNum);

  const handleQuickViewSave = useCallback(async () => {
    const eid = quickViewEvent?.id != null ? Number(quickViewEvent.id) : null;
    if (eid == null || !Number.isInteger(eid) || quickViewSaving) return;
    if (!user?.id) {
      router.push('/login');
      return;
    }
    setQuickViewSaving(true);
    try {
      const isCurrentlySaved = savedEventIds.has(eid);
      if (isCurrentlySaved) {
        const { error } = await supabase
          .from('user_event_saves')
          .delete()
          .eq('user_id', user.id)
          .eq('event_id', eid);
        if (error) {
          Alert.alert("Couldn't update", error.message ?? 'Please try again.');
        } else {
          setSavedEventIds((prev) => {
            const next = new Set(prev);
            next.delete(eid);
            return next;
          });
        }
      } else {
        const { error } = await supabase.from('user_event_saves').insert({ user_id: user.id, event_id: eid });
        if (error) {
          Alert.alert("Couldn't save", error.message ?? 'Please try again.');
        } else {
          setSavedEventIds((prev) => new Set(prev).add(eid));
        }
      }
    } finally {
      setQuickViewSaving(false);
    }
  }, [quickViewEvent?.id, quickViewSaving, router, savedEventIds, user?.id]);

  const upcoming = items.filter((i) => i.statusKind === 'confirmed' || i.statusKind === 'pending');
  const pastAndOther = items.filter((i) => i.statusKind === 'past' || i.statusKind === 'refunded');

  const handleCancelBooking = useCallback(
    (item: UserBookingListItem) => {
      if (!user?.id || cancellingBookingId) return;
      Alert.alert(
        'Cancel booking?',
        'Your payment will be refunded to your original payment method. This usually takes 5–10 business days.',
        [
          { text: 'Keep booking', style: 'cancel' },
          {
            text: 'Cancel & refund',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setCancellingBookingId(item.bookingId);
                try {
                  const { data: sessionData } = await supabase.auth.getSession();
                  const token = sessionData.session?.access_token;
                  if (!token) {
                    Alert.alert('Sign in required', 'Please sign in to cancel this booking.');
                    return;
                  }
                  const result = await cancelUserBooking({
                    bookingId: item.bookingId,
                    accessToken: token,
                  });
                  if (!result.ok) {
                    Alert.alert('Could not cancel', result.message);
                  } else {
                    Alert.alert(
                      'Booking cancelled',
                      'Your refund is being processed. You will receive a confirmation email shortly.'
                    );
                    void loadBookings();
                  }
                } catch {
                  Alert.alert(
                    'Could not cancel',
                    'The request timed out or failed. Check your connection and try again.'
                  );
                } finally {
                  setCancellingBookingId(null);
                }
              })();
            },
          },
        ]
      );
    },
    [user?.id, cancellingBookingId, loadBookings]
  );

  return (
    <View style={{ flex: 1, backgroundColor: DesignColors.creamBg }}>
      <View
        style={{
          paddingTop: DesignSpacing.contentPaddingTop,
          paddingBottom: DesignSpacing.logoHeaderPaddingBottom,
          paddingHorizontal: DesignSpacing.horizontalPadding,
        }}
      >
        <Image
          source={require('@/assets/images/logo.png')}
          style={{
            height: DesignSizes.logoHeight,
            width: DesignSizes.logoWidth,
            marginLeft: DesignSpacing.logoMarginLeft,
          }}
          contentFit="contain"
        />
      </View>

      <View style={{ paddingHorizontal: DesignSpacing.horizontalPadding, paddingBottom: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: DesignColors.charcoal }}>My bookings</Text>
        <Text style={{ marginTop: 4, fontSize: 13, color: DesignColors.mediumGray, lineHeight: 18 }}>
          Confirmed workshops, past sessions, and refunds
        </Text>
      </View>

      {!user?.id ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: DesignSpacing.horizontalPadding }}>
          <Text style={{ fontSize: 15, color: DesignColors.mediumGray, textAlign: 'center', lineHeight: 22 }}>
            Sign in to see workshops you have booked.
          </Text>
          <Pressable
            onPress={() => router.push('/login')}
            style={{
              marginTop: 20,
              alignSelf: 'center',
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 24,
              backgroundColor: DesignColors.primary,
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Sign in</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={DesignColors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: DesignSpacing.horizontalPadding,
            paddingBottom: 24,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DesignColors.primary} />
          }
        >
          {items.length === 0 ? (
            <Text
              style={{
                marginTop: 32,
                fontSize: 14,
                color: DesignColors.mediumGray,
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              No bookings yet. Browse workshops to find your next session.
            </Text>
          ) : (
            <>
              {upcoming.length > 0 ? (
                <View style={{ marginTop: 8 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: DesignColors.mediumGray,
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      marginBottom: 4,
                    }}
                  >
                    Upcoming
                  </Text>
                  {upcoming.map((item) => (
                    <BookingListRow
                      key={item.bookingId}
                      item={item}
                      onPress={() => setQuickViewEvent(item.event)}
                      onCancel={
                        item.canRequestRefund
                          ? () => handleCancelBooking(item)
                          : undefined
                      }
                      cancelBusy={cancellingBookingId === item.bookingId}
                    />
                  ))}
                </View>
              ) : null}
              {pastAndOther.length > 0 ? (
                <View style={{ marginTop: upcoming.length > 0 ? 20 : 8 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: DesignColors.mediumGray,
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      marginBottom: 4,
                    }}
                  >
                    Past & refunded
                  </Text>
                  {pastAndOther.map((item) => (
                    <BookingListRow
                      key={item.bookingId}
                      item={item}
                      onPress={() => setQuickViewEvent(item.event)}
                    />
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}

      <WorkshopQuickViewModal
        visible={!!quickViewEvent}
        event={quickViewEvent}
        onClose={() => setQuickViewEvent(null)}
        userId={user?.id}
        userEmail={user?.email ?? undefined}
        attendeeName={profileDisplayName ?? ''}
        saved={quickViewSaved}
        saving={quickViewSaving}
        onToggleSave={handleQuickViewSave}
        profileLocation={profileLocation ? { lat: profileLocation.lat, lng: profileLocation.lng } : null}
        profilePostalCode={profileLocation?.postal_code ?? null}
        onBookingComplete={loadBookings}
      />
    </View>
  );
}
