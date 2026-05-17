import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
  TextInput,
} from 'react-native';
import CategoryFallbackImage from '@/components/CategoryFallbackImage';
import WorkshopQuickViewModal from '@/components/WorkshopQuickViewModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { DesignColors, DesignSpacing } from '@/constants/design-template';
import {
  mapDbRowToWorkshopEvent,
  WORKSHOP_EVENT_LIST_SELECT,
  type WorkshopEventDbRow,
  type WorkshopEventRow,
} from '@/lib/workshops-events-query';
import { workshopEventIsFull } from '@/lib/workshop-event-utils';

interface Vendor {
  id: string;
  name: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  author_name: string | null;
  created_at: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Date TBD';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function VendorProfileScreen() {
  const { id, eventId: eventIdParam } = useLocalSearchParams<{ id: string; eventId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [events, setEvents] = useState<WorkshopEventRow[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [quickViewEvent, setQuickViewEvent] = useState<WorkshopEventRow | null>(null);
  const [savedEventIds, setSavedEventIds] = useState<Set<number>>(new Set());
  const [quickViewSaving, setQuickViewSaving] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);

  const loadData = () => {
    if (!id) return;
    Promise.all([
      supabase.from('vendors').select('id, name').eq('id', id).single(),
      supabase
        .from('events')
        .select(WORKSHOP_EVENT_LIST_SELECT)
        .eq('vendor_id', id)
        .order('date', { ascending: true }),
      supabase
        .from('vendor_reviews')
        .select('id, rating, comment, author_name, created_at')
        .eq('vendor_id', id)
        .order('created_at', { ascending: false }),
    ]).then(([vendorRes, eventsRes, reviewsRes]) => {
      const eventList = (eventsRes.data ?? []).map((e) =>
        mapDbRowToWorkshopEvent(e as WorkshopEventDbRow)
      );
      setVendor(vendorRes.data ?? null);
      setEvents(eventList);
      const revs = (reviewsRes.data ?? []) as Review[];
      setReviews(revs);
      setAvgRating(revs.length > 0 ? Math.round((revs.reduce((s, r) => s + r.rating, 0) / revs.length) * 10) / 10 : null);
    }).finally(() => setLoading(false));

    if (user?.id) {
      supabase
        .from('vendor_reviews')
        .select('id, rating, comment, author_name, created_at')
        .eq('vendor_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const mine = data as Review;
            setMyReview(mine);
            setRating(mine.rating);
            setComment(mine.comment ?? '');
          } else {
            setMyReview(null);
          }
        });
    } else {
      setMyReview(null);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      supabase
        .from('user_event_saves')
        .select('event_id')
        .eq('user_id', user.id)
        .then(({ data }) => {
          setSavedEventIds(new Set((data ?? []).map((r) => Number(r.event_id))));
        });
    }, [user?.id])
  );

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
          const { data } = await supabase.from('user_event_saves').select('event_id').eq('user_id', user.id);
          if (data) setSavedEventIds(new Set(data.map((r) => Number(r.event_id))));
        }
      } else {
        const { error } = await supabase.from('user_event_saves').insert({ user_id: user.id, event_id: eid });
        if (error) {
          Alert.alert("Couldn't save", error.message ?? 'Please try again.');
        } else {
          setSavedEventIds((prev) => new Set(prev).add(eid));
          const { data } = await supabase.from('user_event_saves').select('event_id').eq('user_id', user.id);
          if (data) setSavedEventIds(new Set(data.map((r) => Number(r.event_id))));
        }
      }
    } finally {
      setQuickViewSaving(false);
    }
  }, [user?.id, quickViewEvent?.id, quickViewSaving, savedEventIds]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        setProfileDisplayName(null);
        return;
      }
      supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setProfileDisplayName(data?.display_name?.trim() || null));
    }, [user?.id])
  );

  useEffect(() => {
    if (loading || !eventIdParam || events.length === 0) return;
    const wantId = Number(eventIdParam);
    if (!Number.isInteger(wantId)) return;
    const found = events.find((e) => e.id === wantId);
    if (found) setQuickViewEvent(found);
  }, [loading, eventIdParam, events]);

  const handleSubmitReview = async () => {
    if (!user || !id || submitting) return;
    setSubmitting(true);
    const authorName = user.user_metadata?.full_name || user.user_metadata?.name || String(user.email ?? '').split('@')[0] || null;
    await supabase.from('vendor_reviews').upsert(
      { user_id: user.id, vendor_id: id, rating, comment: comment.trim() || null, author_name: authorName },
      { onConflict: 'user_id,vendor_id' }
    );
    setComment('');
    loadData();
    setSubmitting(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: DesignColors.mediumGray }}>Loading...</Text>
      </View>
    );
  }

  if (!vendor) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: DesignColors.mediumGray, marginBottom: 16 }}>Vendor not found</Text>
        <Pressable onPress={() => router.back()} style={{ paddingVertical: 10, paddingHorizontal: 20, backgroundColor: DesignColors.primary, borderRadius: 9999 }}>
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
    <ScrollView
      style={{ flex: 1, backgroundColor: DesignColors.creamBg }}
      contentContainerStyle={{ padding: DesignSpacing.horizontalPadding, paddingBottom: 32 }}
    >
      <View style={{ marginTop: DesignSpacing.contentPaddingTop, marginBottom: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: DesignColors.charcoal }}>
          {vendor.name}
        </Text>
        <Text style={{ fontSize: 15, color: DesignColors.mediumGray, marginTop: 4 }}>
          Workshop host
        </Text>
        {avgRating != null && (
          <Text style={{ fontSize: 14, color: DesignColors.mediumGray, marginTop: 8 }}>
            {avgRating} stars ({reviews.length} reviews)
          </Text>
        )}
      </View>

      {user && (
        <View style={{ marginBottom: 24, padding: 16, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: DesignColors.lightGreenBorder }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: DesignColors.charcoal, marginBottom: 12 }}>
            {myReview ? 'Edit your review (one per vendor)' : 'Leave a review'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Pressable key={s} onPress={() => setRating(s)}>
                <Text style={{ fontSize: 24 }}>{s <= rating ? '★' : '☆'}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            placeholder="Share your experience..."
            placeholderTextColor={DesignColors.mediumGray}
            value={comment}
            onChangeText={setComment}
            multiline
            style={{ borderWidth: 1, borderColor: DesignColors.lightGreenBorder, borderRadius: 12, padding: 12, fontSize: 14, color: DesignColors.charcoal, minHeight: 80 }}
          />
          <Pressable
            onPress={handleSubmitReview}
            disabled={submitting}
            style={{ marginTop: 12, paddingVertical: 12, borderRadius: 9999, backgroundColor: DesignColors.primary, alignItems: 'center' }}
          >
            <Text style={{ color: '#FFF', fontWeight: '600' }}>{submitting ? 'Submitting...' : myReview ? 'Update review' : 'Submit review'}</Text>
          </Pressable>
        </View>
      )}

      <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal, marginBottom: 12 }}>Reviews</Text>
      {reviews.length === 0 ? (
        <Text style={{ color: DesignColors.mediumGray, marginBottom: 24 }}>No reviews yet.</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={{
            flexDirection: 'row',
            gap: 12,
            paddingLeft: DesignSpacing.horizontalPadding,
            paddingRight: DesignSpacing.horizontalPadding,
            paddingBottom: 8,
          }}
          style={{ marginHorizontal: -DesignSpacing.horizontalPadding }}
        >
          {reviews.map((r) => (
            <View
              key={r.id}
              style={{
                width: Math.min(280, Dimensions.get('window').width - DesignSpacing.horizontalPadding * 2 - 12),
                minWidth: 260,
                padding: 12,
                backgroundColor: '#FFF',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
              }}
            >
              <Text style={{ fontSize: 14, color: DesignColors.mediumGray }}>
                {r.author_name || 'Anonymous'} • {new Date(r.created_at).toLocaleDateString()} • {r.rating}★
              </Text>
              {r.comment ? <Text style={{ marginTop: 4, fontSize: 14, color: DesignColors.charcoal }}>{r.comment}</Text> : null}
            </View>
          ))}
        </ScrollView>
      )}

      <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal, marginBottom: 16 }}>
        Upcoming Workshops
      </Text>

      {events.length === 0 ? (
        <Text style={{ color: DesignColors.mediumGray }}>No upcoming workshops from this vendor.</Text>
      ) : (
        events.map((event) => (
          <Pressable
            key={event.id}
            onPress={() => !workshopEventIsFull(event) && setQuickViewEvent(event)}
            disabled={workshopEventIsFull(event)}
            style={{
              backgroundColor: '#FFF',
              borderRadius: 16,
              overflow: 'hidden',
              marginBottom: 12,
              borderWidth: 1,
              borderColor: DesignColors.lightGreenBorder,
              opacity: workshopEventIsFull(event) ? 0.45 : 1,
            }}
          >
            <View style={{ height: 160, backgroundColor: DesignColors.inputBg }}>
              <CategoryFallbackImage
                imageUrl={event.image_url}
                category={event.category}
                style={{ width: '100%', height: 160 }}
                contentFit="cover"
                recyclingKey={`vendor-event-${event.id}`}
              />
              {event.category && (
                <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: DesignColors.charcoal }}>{event.category}</Text>
                </View>
              )}
            </View>
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: DesignColors.charcoal }} numberOfLines={2}>
                {event.title}
              </Text>
              <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginTop: 4 }}>{event.date}</Text>
              {event.location && (
                <Text style={{ fontSize: 13, color: DesignColors.mediumGray }} numberOfLines={1}>
                  {event.location}
                </Text>
              )}
              {event.external_link && (
                <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.primary, marginTop: 8 }}>
                  Book →
                </Text>
              )}
            </View>
          </Pressable>
        ))
      )}

      <Pressable
        onPress={() => router.replace('/(tabs)/workshops')}
        style={{ marginTop: 24, paddingVertical: 14, borderRadius: 9999, borderWidth: 1, borderColor: DesignColors.primary, alignItems: 'center' }}
      >
        <Text style={{ fontSize: 15, fontWeight: '600', color: DesignColors.primary }}>Back to Workshops</Text>
      </Pressable>
    </ScrollView>

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
        profileLocation={null}
        onBookingComplete={loadData}
      />
    </>
  );
}
