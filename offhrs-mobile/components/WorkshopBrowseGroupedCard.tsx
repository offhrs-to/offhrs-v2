import * as Linking from 'expo-linking';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import CategoryFallbackImage from '@/components/CategoryFallbackImage';
import { EventSaveHeartIcon } from '@/components/EventSaveHeartIcon';
import { DesignColors } from '@/constants/design-template';
import { useAuth } from '@/contexts/AuthContext';
import { haversineKm } from '@/lib/distance';
import { postLegacyBookTap, runPaidWorkshopBooking } from '@/lib/saas-booking-mobile';
import { shareWorkshopEvent } from '@/lib/share-workshop';
import type { WorkshopEventRow } from '@/lib/workshops-events-query';
import { workshopSessionKey } from '@/lib/workshops-events-query';
import { compareWorkshopEventsByStart, workshopEventTorontoYmd } from '@/lib/workshop-event-sort';
import {
  getSeriesMode,
  isMultiWeekEvent,
  parseSeriesOccurrences,
  type EventSeriesFields,
} from '@/lib/workshop-series';
import { supabase } from '@/lib/supabase';
import { workshopDisplayPrice, workshopEventIsFull, workshopIsSaasVendorEvent } from '@/lib/workshop-event-utils';
import { vendorPagePath, workshopVendorDisplayName } from '@/lib/workshop-vendor-display';

/** Compact square thumbnail (top-right of card), Classpass-style — does not span full card height. */
const THUMB_SIZE = 88;
const THUMB_RADIUS = 12;
/** Share control + gap + thumbnail — reserved so title text never runs under these. */
const SHARE_BTN_SIZE = 32;
const SIDE_RAIL_GAP = 6;
const SIDE_RAIL_WIDTH = SHARE_BTN_SIZE + SIDE_RAIL_GAP + THUMB_SIZE;

function formatPrice(price: number | string | null | undefined): string | null {
  if (price == null) return null;
  const s = typeof price === 'string' ? price.replace(/^\$/, '').trim() : String(price);
  if (s === '' || isNaN(Number(s))) return null;
  return `$${s}`;
}

function formatTimePill(r: WorkshopEventRow): string {
  const raw = r.date_iso ?? r.date;
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return r.date?.slice(0, 16) ?? '—';
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Toronto',
    });
  } catch {
    return '—';
  }
}

function formatSessionPill(r: WorkshopEventRow, showDate: boolean): string {
  if (!showDate) return formatTimePill(r);
  const raw = r.date_iso ?? r.date;
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return formatTimePill(r);
    const day = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Toronto',
    });
    return `${day} · ${formatTimePill(r)}`;
  } catch {
    return formatTimePill(r);
  }
}

/** Calendar day only (no time) — matches strip context for the selected day. */
function formatDayLine(r: WorkshopEventRow): string {
  const raw = r.date_iso ?? r.date;
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Toronto',
    });
  } catch {
    return '';
  }
}

function neighborhoodLine(loc: string | null | undefined, maxLen = 36): string | null {
  if (!loc || !loc.trim()) return null;
  const t = loc.trim();
  const comma = t.indexOf(',');
  const short = comma > 0 ? t.slice(0, comma).trim() : t;
  if (short.length <= maxLen) return short;
  return `${short.slice(0, maxLen - 1)}…`;
}

const softShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.04,
  shadowRadius: 30,
  elevation: 4,
};

type Props = {
  group: WorkshopEventRow[];
  profileLocation: { lat: number; lng: number } | null;
  savedEventIds: Set<number>;
  onSaveChange: (eventId: number, saved: boolean) => void;
  /** Opens workshop quick view for the given session row (title, address, date, price, time). */
  onOpenQuickView?: (event: WorkshopEventRow) => void;
};

function QuickViewTap({
  onOpenQuickView,
  event,
  label,
  children,
  style,
}: {
  onOpenQuickView?: (event: WorkshopEventRow) => void;
  event: WorkshopEventRow;
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  if (!onOpenQuickView) {
    return <View style={style}>{children}</View>;
  }
  return (
    <Pressable
      onPress={() => onOpenQuickView(event)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [style, pressed ? { opacity: 0.72 } : null]}
    >
      {children}
    </Pressable>
  );
}

export default function WorkshopBrowseGroupedCard({
  group,
  profileLocation,
  savedEventIds,
  onSaveChange,
  onOpenQuickView,
}: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const sorted = useMemo(() => [...group].sort(compareWorkshopEventsByStart), [group]);
  const sessionKeys = sorted.map((r) => workshopSessionKey(r)).join(',');
  const showDateOnPills = useMemo(() => {
    const ymds = new Set(sorted.map((r) => workshopEventTorontoYmd(r)).filter(Boolean));
    return ymds.size > 1;
  }, [sorted]);

  const [selectedSessionKey, setSelectedSessionKey] = useState<string | null>(() =>
    sorted[0] ? workshopSessionKey(sorted[0]) : null
  );
  const [saving, setSaving] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);

  useEffect(() => {
    const keys = sessionKeys.split(',').filter(Boolean);
    const rows = sorted.filter((r) => keys.includes(workshopSessionKey(r)));
    const firstOpenKey =
      rows.find((r) => !workshopEventIsFull(r)) != null
        ? workshopSessionKey(rows.find((r) => !workshopEventIsFull(r))!)
        : rows[0]
          ? workshopSessionKey(rows[0])
          : null;
    setSelectedSessionKey((prev) => {
      if (prev != null && keys.includes(prev)) {
        const prevRow = sorted.find((s) => workshopSessionKey(s) === prev);
        if (prevRow && !workshopEventIsFull(prevRow)) return prev;
      }
      return firstOpenKey;
    });
  }, [sessionKeys, sorted]);

  const selected = useMemo(
    () => sorted.find((r) => workshopSessionKey(r) === selectedSessionKey) ?? sorted[0],
    [sorted, selectedSessionKey]
  );

  const displayPrice = workshopDisplayPrice(selected) ?? formatPrice(selected?.price);
  const displaySaved = selected != null && savedEventIds.has(selected.id);
  const distanceKm = useMemo(() => {
    if (!profileLocation || selected?.lat == null || selected?.lng == null) return undefined;
    return (
      Math.round(
        haversineKm(profileLocation.lat, profileLocation.lng, Number(selected.lat), Number(selected.lng)) * 10
      ) / 10
    );
  }, [profileLocation, selected?.lat, selected?.lng]);

  const handleSave = async () => {
    if (!user || selected == null || saving) return;
    const eventId = selected.id;
    setSaving(true);
    try {
      if (displaySaved) {
        const { error } = await supabase
          .from('user_event_saves')
          .delete()
          .eq('user_id', user.id)
          .eq('event_id', eventId);
        if (error) {
          Alert.alert("Couldn't update", error.message ?? 'Please try again.');
          return;
        }
        onSaveChange(eventId, false);
      } else {
        const { error } = await supabase.from('user_event_saves').insert({ user_id: user.id, event_id: eventId });
        if (error) {
          Alert.alert("Couldn't save", error.message ?? 'Please try again.');
          return;
        }
        onSaveChange(eventId, true);
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
    if (selected == null) return;
    if (workshopEventIsFull(selected)) return;

    if (workshopIsSaasVendorEvent(selected)) {
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
          eventId: selected.id,
          attendeeName: name,
          attendeeEmail: user.email,
          startTimeIso: selected.date_iso,
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

    await postLegacyBookTap(selected.id, selected.title);
    const url = selected.external_link?.trim();
    if (url) Linking.openURL(url);
  };

  // Cohort multi_week series (weekly_same / weekly_custom): one bookable unit.
  // Surface the commitment with a "{N}-week series" / "{N}-session series" label
  // instead of fanning the time pill row.
  const seriesInfo = useMemo(() => {
    if (selected == null) return null;
    const fields = selected as EventSeriesFields;
    if (!isMultiWeekEvent(fields)) return null;
    if (getSeriesMode(fields) !== 'cohort') return null;
    const occs = parseSeriesOccurrences(fields);
    if (occs.length < 2) return null;
    const pattern = (selected.partner_series_meta as { pattern?: string } | null | undefined)?.pattern;
    const unit = pattern === 'weekly_same' ? 'week' : 'session';
    return { count: occs.length, label: `${occs.length}-${unit} series` };
  }, [selected]);

  if (sorted.length === 0 || selected == null) return null;

  const title = selected.title;
  const first = sorted[0]!;
  const dayLine = formatDayLine(selected) || formatDayLine(first);
  const locationLine = neighborhoodLine(selected.location);
  const vendorName = workshopVendorDisplayName(selected);
  const vendorPath = vendorPagePath(selected);

  return (
    <View
      style={[
        softShadow,
        {
          overflow: 'hidden',
          borderRadius: 20,
          backgroundColor: '#FFF',
          width: '100%',
        },
      ]}
    >
      <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View
            style={{
              flex: 1,
              minWidth: 0,
              flexBasis: 0,
              marginRight: 8,
              overflow: 'hidden',
            }}
          >
            <QuickViewTap
              onOpenQuickView={onOpenQuickView}
              event={selected}
              label={`View details for ${title}`}
              style={{ width: '100%', marginBottom: 6 }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: DesignColors.charcoal,
                  textAlign: 'left',
                  width: '100%',
                }}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {title}
              </Text>
            </QuickViewTap>

            {locationLine ? (
              <QuickViewTap
                onOpenQuickView={onOpenQuickView}
                event={selected}
                label={`View location for ${title}`}
                style={{ width: '100%' }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color: DesignColors.mediumGray,
                    textAlign: 'left',
                    width: '100%',
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {locationLine}
                </Text>
              </QuickViewTap>
            ) : null}

            {dayLine ? (
              <QuickViewTap
                onOpenQuickView={onOpenQuickView}
                event={selected}
                label={`View date for ${title}`}
                style={{ marginTop: 4, width: '100%' }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: DesignColors.charcoal,
                    textAlign: 'left',
                    width: '100%',
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {dayLine}
                </Text>
              </QuickViewTap>
            ) : null}

            {distanceKm != null ? (
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  color: DesignColors.mediumGray,
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                {distanceKm} km
              </Text>
            ) : null}

            {displayPrice != null ? (
              <QuickViewTap
                onOpenQuickView={onOpenQuickView}
                event={selected}
                label={`View price for ${title}`}
                style={{ marginTop: 4 }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: DesignColors.charcoal, textAlign: 'left' }}>
                  {displayPrice}
                </Text>
              </QuickViewTap>
            ) : null}
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: SIDE_RAIL_GAP,
              flexShrink: 0,
              width: SIDE_RAIL_WIDTH,
            }}
          >
            {/* Match heart overlay: paddingTop 4 + 36×36 control so share aligns with save on the same row */}
            <View
              style={{
                height: THUMB_SIZE,
                width: SHARE_BTN_SIZE,
                paddingTop: 4,
                alignItems: 'center',
                justifyContent: 'flex-start',
              }}
            >
              <Pressable
                onPress={() => void shareWorkshopEvent({ id: selected.id, title })}
                accessibilityRole="button"
                accessibilityLabel="Share workshop"
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                style={({ pressed }) => ({
                  width: SHARE_BTN_SIZE,
                  height: SHARE_BTN_SIZE,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <MaterialCommunityIcons name="share-variant" size={22} color={DesignColors.primary} />
              </Pressable>
            </View>

            <View
            style={{
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              position: 'relative',
              flexShrink: 0,
              borderRadius: THUMB_RADIUS,
              backgroundColor: '#F5F5F5',
              overflow: 'visible',
              // Pin overlay coords to visual LTR so `right` / flex-end = top-right of photo (not mirrored in RTL).
              direction: 'ltr',
            }}
          >
            <View
              style={{
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                borderRadius: THUMB_RADIUS,
                overflow: 'hidden',
                backgroundColor: '#F5F5F5',
              }}
            >
              <CategoryFallbackImage
                imageUrl={first.image_url}
                category={first.category}
                style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
                contentFit="cover"
                recyclingKey={`browse-group-${first.id}`}
              />
            </View>
            <View
              pointerEvents="box-none"
              collapsable={false}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 4,
                elevation: Platform.OS === 'android' ? 8 : undefined,
                direction: 'ltr',
                flexDirection: 'row',
                justifyContent: 'flex-end',
                alignItems: 'flex-start',
                paddingTop: 4,
                paddingRight: 4,
              }}
            >
              <Pressable
                onPress={onHeartPress}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={displaySaved ? 'Remove from saved workshops' : 'Save workshop'}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                style={({ pressed }) => ({
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 2,
                  borderColor: DesignColors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.88 : 1,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 3,
                  elevation: Platform.OS === 'android' ? 6 : undefined,
                })}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={DesignColors.primary} />
                ) : (
                  <EventSaveHeartIcon saved={displaySaved} size={18} />
                )}
              </Pressable>
            </View>
          </View>
          </View>
        </View>

        {seriesInfo ? (
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <View
              accessibilityRole="text"
              accessibilityLabel={seriesInfo.label}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: DesignColors.heroBg,
                borderWidth: 1,
                borderColor: DesignColors.primary,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: DesignColors.primary }}>
                {seriesInfo.label}
              </Text>
            </View>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 6, maxWidth: '100%' }}
            contentContainerStyle={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingRight: 4 }}
          >
            {sorted.map((slot) => {
              const slotKey = workshopSessionKey(slot);
              const active = slotKey === selectedSessionKey;
              const slotFull = workshopEventIsFull(slot);
              const pillLabel = formatSessionPill(slot, showDateOnPills);
              return (
                <Pressable
                  key={slotKey}
                  onPress={() => {
                    if (slotFull) return;
                    if (onOpenQuickView) {
                      onOpenQuickView(slot);
                    }
                    setSelectedSessionKey(slotKey);
                  }}
                  disabled={slotFull}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: slotFull }}
                  accessibilityLabel={`${pillLabel}${slotFull ? ', full' : active ? ', selected' : ''}`}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: active ? DesignColors.heroBg : '#FFF',
                    borderWidth: 1,
                    borderColor: active ? DesignColors.primary : DesignColors.lightGreenBorder,
                    opacity: slotFull ? 0.45 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: slotFull ? DesignColors.mediumGray : active ? DesignColors.primary : DesignColors.charcoal,
                    }}
                  >
                    {slotFull ? `${pillLabel} · Full` : pillLabel}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 12, width: '100%' }}>
          {vendorPath ? (
            <Pressable
              onPress={() => router.push(vendorPath)}
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
              <Text style={{ fontSize: 11, fontWeight: '600', color: DesignColors.primary }}>Vendor</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => void handleBook()}
            disabled={bookingBusy || (selected != null && workshopEventIsFull(selected))}
            style={{
              flex: 1,
              minWidth: 0,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor:
                selected != null && workshopEventIsFull(selected) ? '#B8C4B8' : DesignColors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {bookingBusy ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFF' }}>
                {selected != null && workshopEventIsFull(selected) ? 'Full' : 'Book'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
