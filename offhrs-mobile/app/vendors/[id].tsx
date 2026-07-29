import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InstagramIcon from '@/components/InstagramIcon';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import CategoryFallbackImage from '@/components/CategoryFallbackImage';
import VendorBioCollapsible from '@/components/VendorBioCollapsible';
import WorkshopQuickViewModal from '@/components/WorkshopQuickViewModal';
import {
  formatVendorWebsiteLabel,
  normalizeVendorWebsiteUrl,
  openVendorContactEmail,
  resolveVendorPublicProfile,
} from '@/lib/vendor-profile-bio';
import { supabase } from '@/lib/supabase';
import { instagramProfileUrl } from '@/lib/instagram-handle';
import {
  patchSavedEventIds,
  subscribeEventSavesChanged,
  toggleUserEventSave,
} from '@/lib/event-saves';
import { useAuth } from '@/contexts/AuthContext';
import { DesignColors, DesignSpacing } from '@/constants/design-template';
import {
  fetchVendorProfileEvents,
  fetchVendorProfileEventsByProfileId,
  fetchWorkshopEventForQuickView,
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

const WORKSHOP_CARD_IMAGE_HEIGHT = 160;

const VendorWorkshopCard = memo(function VendorWorkshopCard({
  event,
  onPress,
}: {
  event: WorkshopEventRow;
  onPress: () => void;
}) {
  const full = workshopEventIsFull(event);
  return (
    <Pressable
      onPress={onPress}
      disabled={full}
      style={{
        backgroundColor: '#FFF',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: DesignColors.lightGreenBorder,
        opacity: full ? 0.45 : 1,
      }}
    >
      <View
        style={{
          height: WORKSHOP_CARD_IMAGE_HEIGHT,
          backgroundColor: '#FFF',
          padding: 14,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <CategoryFallbackImage
          imageUrl={event.image_url}
          category={event.category}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
          recyclingKey={`vendor-event-${event.id}`}
        />
        {event.category ? (
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: 'rgba(255,255,255,0.9)',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 9999,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: DesignColors.charcoal }}>
              {event.category}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: DesignColors.charcoal }} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginTop: 4 }}>{event.date}</Text>
        {event.location ? (
          <Text style={{ fontSize: 13, color: DesignColors.mediumGray }} numberOfLines={1}>
            {event.location}
          </Text>
        ) : null}
        {event.external_link ? (
          <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.primary, marginTop: 8 }}>
            Book →
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

export default function VendorProfileScreen() {
  const { id, eventId: eventIdParam, vendorProfileId: vendorProfileIdParam } =
    useLocalSearchParams<{ id: string; eventId?: string; vendorProfileId?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [events, setEvents] = useState<WorkshopEventRow[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [quickViewEvent, setQuickViewEvent] = useState<WorkshopEventRow | null>(null);
  const [savedEventIds, setSavedEventIds] = useState<Set<number>>(new Set());
  const [quickViewSaving, setQuickViewSaving] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [profilePostalCode, setProfilePostalCode] = useState<string | null>(null);
  const [profileLocation, setProfileLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [vendorBio, setVendorBio] = useState<string | null>(null);
  const [vendorWebsiteUrl, setVendorWebsiteUrl] = useState<string | null>(null);
  const [vendorContactEmail, setVendorContactEmail] = useState<string | null>(null);
  const [vendorInstagramHandle, setVendorInstagramHandle] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const loadVendorProfile = useCallback(async () => {
    if (!id) return;
    setProfileLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const publicProfile = await resolveVendorPublicProfile({
        legacyVendorId: id,
        vendorProfileIdParam: vendorProfileIdParam ?? null,
        accessToken: sessionData.session?.access_token ?? null,
      });
      setVendorBio(publicProfile.bio);
      setVendorWebsiteUrl(publicProfile.websiteUrl);
      setVendorContactEmail(publicProfile.contactEmail);
      setVendorInstagramHandle(publicProfile.instagramHandle);
    } finally {
      setProfileLoading(false);
    }
  }, [id, vendorProfileIdParam]);

  const loadCoreData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setEventsLoading(true);
    try {
      const profileIdHint = (vendorProfileIdParam ?? '').trim() || null;

      const [vendorRes, reviewsRes] = await Promise.all([
        supabase.from('vendors').select('id, name, slug').eq('id', id).maybeSingle(),
        supabase
          .from('vendor_reviews')
          .select('id, rating, comment, author_name, created_at')
          .eq('vendor_id', id)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      let eventRows: WorkshopEventRow[] = [];
      if (vendorRes.data) {
        setVendor(vendorRes.data);
        eventRows = await fetchVendorProfileEvents(id);
        // Partner listings may be linked by vendor_profile_id before legacy vendor_id is populated.
        if (eventRows.length === 0 && profileIdHint) {
          eventRows = await fetchVendorProfileEventsByProfileId(profileIdHint);
        }
      } else {
        const profileLookupId = profileIdHint || id;
        const { data: profile } = await supabase
          .from('vendor_profiles')
          .select('id, business_name')
          .eq('id', profileLookupId)
          .in('status', ['trialing', 'active', 'past_due'])
          .maybeSingle();
        if (profile) {
          setVendor({
            id: profile.id,
            name: profile.business_name?.trim() || 'Partner studio',
          });
          eventRows = await fetchVendorProfileEventsByProfileId(profile.id);
        } else {
          setVendor(null);
        }
      }

      setEvents(eventRows);

      const revs = (reviewsRes.data ?? []) as Review[];
      setReviews(revs);
      setAvgRating(
        revs.length > 0 ? Math.round((revs.reduce((s, r) => s + r.rating, 0) / revs.length) * 10) / 10 : null
      );
    } finally {
      setLoading(false);
      setEventsLoading(false);
    }
  }, [id, vendorProfileIdParam]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadCoreData(), loadVendorProfile()]);
  }, [loadCoreData, loadVendorProfile]);

  useEffect(() => {
    void loadCoreData();
    void loadVendorProfile();
  }, [loadCoreData, loadVendorProfile]);

  useEffect(() => {
    if (!id || !user?.id) {
      setMyReview(null);
      return;
    }
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
  }, [id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        setSavedEventIds(new Set());
        return;
      }
      supabase
        .from('user_event_saves')
        .select('event_id')
        .eq('user_id', user.id)
        .then(({ data }) => {
          setSavedEventIds(new Set((data ?? []).map((r) => Number(r.event_id))));
        });
    }, [user?.id])
  );

  useEffect(() => {
    return subscribeEventSavesChanged(({ eventId, saved }) => {
      setSavedEventIds((prev) => patchSavedEventIds(prev, eventId, saved));
    });
  }, []);

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
      const result = await toggleUserEventSave({
        userId: user.id,
        eventId: eid,
        currentlySaved: isCurrentlySaved,
      });
      if (!result.ok) {
        Alert.alert(isCurrentlySaved ? "Couldn't update" : "Couldn't save", result.message);
        return;
      }
      setSavedEventIds((prev) => patchSavedEventIds(prev, eid, result.saved));
    } finally {
      setQuickViewSaving(false);
    }
  }, [user?.id, quickViewEvent?.id, quickViewSaving, savedEventIds, router]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        setProfileDisplayName(null);
        setProfilePostalCode(null);
        setProfileLocation(null);
        return;
      }
      supabase
        .from('profiles')
        .select('display_name, postal_code, location_lat, location_lng')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setProfileDisplayName(data?.display_name?.trim() || null);
          setProfilePostalCode(data?.postal_code?.trim() || null);
          if (data?.location_lat != null && data?.location_lng != null) {
            setProfileLocation({
              lat: Number(data.location_lat),
              lng: Number(data.location_lng),
            });
          } else {
            setProfileLocation(null);
          }
        });
    }, [user?.id])
  );

  useEffect(() => {
    if (eventsLoading || !eventIdParam || events.length === 0) return;
    const wantId = Number(eventIdParam);
    if (!Number.isInteger(wantId)) return;
    const found = events.find((e) => e.id === wantId);
    if (!found || workshopEventIsFull(found)) return;
    setQuickViewEvent(found);
    let cancelled = false;
    void fetchWorkshopEventForQuickView(wantId).then((full) => {
      if (cancelled || !full) return;
      setQuickViewEvent({
        ...full,
        date: found.date || full.date,
        date_iso: found.date_iso || full.date_iso,
        available_slots: found.available_slots ?? full.available_slots,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [eventsLoading, eventIdParam, events]);

  const handleSubmitReview = async () => {
    if (!user || !id || submitting) return;
    setSubmitting(true);
    const authorName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      String(user.email ?? '').split('@')[0] ||
      null;
    await supabase.from('vendor_reviews').upsert(
      { user_id: user.id, vendor_id: id, rating, comment: comment.trim() || null, author_name: authorName },
      { onConflict: 'user_id,vendor_id' }
    );
    setComment('');
    await loadCoreData();
    setSubmitting(false);
  };

  const openWorkshop = useCallback((event: WorkshopEventRow) => {
    if (workshopEventIsFull(event)) return;
    // Show immediately, then hydrate with the same full payload browse/map use
    // (description, legacy price, vendor name, lat/lng for distance).
    setQuickViewEvent(event);
    const eid = Number(event.id);
    if (!Number.isInteger(eid)) return;
    void fetchWorkshopEventForQuickView(eid).then((full) => {
      if (!full) return;
      setQuickViewEvent((prev) => {
        if (!prev || prev.id !== full.id) return prev;
        // Keep the occurrence the user tapped if expand changed date_iso.
        return {
          ...full,
          date: prev.date || full.date,
          date_iso: prev.date_iso || full.date_iso,
          available_slots: prev.available_slots ?? full.available_slots,
        };
      });
    });
  }, []);

  const renderWorkshopItem = useCallback(
    ({ item }: { item: WorkshopEventRow }) => (
      <VendorWorkshopCard event={item} onPress={() => openWorkshop(item)} />
    ),
    [openWorkshop]
  );

  const listHeader = (
    <>
        <View style={{ marginTop: DesignSpacing.contentPaddingTop, marginBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: DesignColors.charcoal }}>
            {vendor?.name ?? 'Workshop host'}
          </Text>
          <Text style={{ fontSize: 15, color: DesignColors.mediumGray, marginTop: 4 }}>Workshop host</Text>
        {profileLoading && !vendorBio && !vendorWebsiteUrl ? (
          <ActivityIndicator size="small" color={DesignColors.primary} style={{ marginTop: 12 }} />
        ) : null}
        {vendorWebsiteUrl ? (
          <Pressable
            onPress={() => {
              const url = normalizeVendorWebsiteUrl(vendorWebsiteUrl);
              if (url) void Linking.openURL(url);
            }}
            accessibilityRole="link"
            style={{ marginTop: 10, alignSelf: 'flex-start' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.primary }}>
              {formatVendorWebsiteLabel(vendorWebsiteUrl)}
            </Text>
          </Pressable>
        ) : null}
        {vendorContactEmail || vendorInstagramHandle ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              marginTop: 10,
              alignSelf: 'flex-start',
            }}
          >
            {vendorContactEmail ? (
              <Pressable
                onPress={() => vendor && openVendorContactEmail(vendor.name, vendorContactEmail)}
                accessibilityRole="button"
                accessibilityLabel={`Email ${vendor?.name ?? 'host'}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              >
                <MaterialIcons name="mail-outline" size={22} color={DesignColors.mediumGray} />
              </Pressable>
            ) : null}
            {vendorInstagramHandle ? (
              <Pressable
                onPress={() => {
                  const url = instagramProfileUrl(vendorInstagramHandle);
                  if (url) void Linking.openURL(url);
                }}
                accessibilityRole="link"
                accessibilityLabel={`Open ${vendor?.name ?? 'host'} on Instagram`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              >
                <InstagramIcon size={22} color={DesignColors.mediumGray} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {vendorBio ? (
          <VendorBioCollapsible bio={vendorBio} style={{ marginTop: vendorWebsiteUrl ? 8 : 10 }} />
        ) : null}
        {avgRating != null ? (
          <Text style={{ fontSize: 14, color: DesignColors.mediumGray, marginTop: 8 }}>
            {avgRating} stars ({reviews.length} reviews)
          </Text>
        ) : null}
      </View>

      {user ? (
        <View
          style={{
            marginBottom: 24,
            padding: 16,
            backgroundColor: '#FFF',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: DesignColors.lightGreenBorder,
          }}
        >
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
            style={{
              borderWidth: 1,
              borderColor: DesignColors.lightGreenBorder,
              borderRadius: 12,
              padding: 12,
              fontSize: 14,
              color: DesignColors.charcoal,
              minHeight: 80,
            }}
          />
          <Pressable
            onPress={() => void handleSubmitReview()}
            disabled={submitting}
            style={{
              marginTop: 12,
              paddingVertical: 12,
              borderRadius: 9999,
              backgroundColor: DesignColors.primary,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFF', fontWeight: '600' }}>
              {submitting ? 'Submitting...' : myReview ? 'Update review' : 'Submit review'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal, marginBottom: 12 }}>
        Reviews
      </Text>
      {reviews.length === 0 ? (
        <Text style={{ color: DesignColors.mediumGray, marginBottom: 24 }}>No reviews yet.</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={{
            flexDirection: 'row',
            gap: 12,
            paddingBottom: 8,
          }}
          style={{ marginBottom: 16 }}
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
              {r.comment ? (
                <Text style={{ marginTop: 4, fontSize: 14, color: DesignColors.charcoal }}>{r.comment}</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}

      <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal, marginBottom: 16 }}>
        Upcoming Workshops
      </Text>
      {eventsLoading ? (
        <ActivityIndicator color={DesignColors.primary} style={{ marginBottom: 24 }} />
      ) : null}
    </>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DesignColors.creamBg }}>
        <ActivityIndicator color={DesignColors.primary} />
        <Text style={{ marginTop: 12, color: DesignColors.mediumGray }}>Loading vendor...</Text>
      </View>
    );
  }

  if (!vendor) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: DesignColors.creamBg }}>
        <Text style={{ color: DesignColors.mediumGray, marginBottom: 16 }}>Vendor not found</Text>
        <Pressable
          onPress={() => router.back()}
          style={{ paddingVertical: 10, paddingHorizontal: 20, backgroundColor: DesignColors.primary, borderRadius: 9999 }}
        >
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={eventsLoading ? [] : events}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderWorkshopItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          eventsLoading ? null : (
            <Text style={{ color: DesignColors.mediumGray, marginBottom: 24 }}>
              No upcoming workshops from this vendor.
            </Text>
          )
        }
        ListFooterComponent={
          <Pressable
            onPress={() => router.replace('/(tabs)/workshops')}
            style={{
              marginTop: 12,
              marginBottom: Platform.OS === 'android' ? Math.max(insets.bottom + 96, 112) : 32,
              paddingVertical: 14,
              borderRadius: 9999,
              borderWidth: 1,
              borderColor: DesignColors.primary,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: DesignColors.primary }}>Back to Workshops</Text>
          </Pressable>
        }
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        style={{ flex: 1, backgroundColor: DesignColors.creamBg }}
        contentContainerStyle={{
          paddingHorizontal: DesignSpacing.horizontalPadding,
          paddingBottom: 8,
        }}
      />

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
        profileLocation={profileLocation}
        profilePostalCode={profilePostalCode}
        onBookingComplete={() => void reloadAll()}
      />
    </>
  );
}
