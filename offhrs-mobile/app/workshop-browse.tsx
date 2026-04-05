import WorkshopBrowseGroupedCard from '@/components/WorkshopBrowseGroupedCard';
import WorkshopsChrome from '@/components/WorkshopsChrome';
import { CATEGORIES } from '@/constants/categories';
import { DesignColors, DesignSpacing } from '@/constants/design-template';
import { WORKSHOP_LIST_PAGE_SIZE } from '@/constants/workshops-list';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { buildDateStrip, eventMatchesCalendarDay, getTorontoYmd } from '@/lib/workshop-calendar';
import type { WorkshopEventRow } from '@/lib/workshops-events-query';
import { fetchWorkshopEvents } from '@/lib/workshops-events-query';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LIST_GAP = 12;

function parseParamString(v: string | string[] | undefined): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : v[0] ?? '';
}

function eventSortMs(r: WorkshopEventRow): number {
  if (r.date_iso) {
    const t = new Date(r.date_iso).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const t = new Date(r.date).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Same workshop listing (vendor + title) on the same calendar day → one card with multiple time pills. */
function workshopGroupKey(e: WorkshopEventRow): string {
  const v = e.vendor_id ?? '';
  const t = e.title.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${v}\u0001${t}`;
}

/** Non-recurring events on or after today (Toronto); recurring rows always included. */
function eventIsUpcomingToronto(e: WorkshopEventRow): boolean {
  if (e.recurrence === 'daily' || e.recurrence === 'weekly') return true;
  if (!e.date_iso) return false;
  return e.date_iso.slice(0, 10) >= getTorontoYmd();
}

function browseGroupKey(e: WorkshopEventRow, mode: 'single-day' | 'all-dates'): string {
  if (mode === 'single-day') return workshopGroupKey(e);
  if (e.recurrence === 'daily' || e.recurrence === 'weekly') return `rec:${e.id}`;
  const ymd = e.date_iso ? e.date_iso.slice(0, 10) : '';
  return `${ymd}\u0001${workshopGroupKey(e)}`;
}

export default function WorkshopBrowseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    q?: string;
    categories?: string;
  }>();

  const paramQ = parseParamString(params.q);
  const paramCat = parseParamString(params.categories);
  const initialCategory =
    paramCat && (CATEGORIES as readonly string[]).includes(paramCat) ? paramCat : null;

  const [searchTerm, setSearchTerm] = useState(paramQ);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory);

  const strip = useMemo(() => buildDateStrip(90), []);
  /** `null` = show all upcoming dates, chronological (soonest first). */
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<WorkshopEventRow[]>([]);
  const [listPage, setListPage] = useState(1);

  const [savedEventIds, setSavedEventIds] = useState<Set<number>>(new Set());

  const [profileLocation, setProfileLocation] = useState<{
    lat: number;
    lng: number;
    postal_code: string | null;
  } | null>(null);

  useEffect(() => {
    setSearchTerm(paramQ);
  }, [paramQ]);

  useEffect(() => {
    const next =
      paramCat && (CATEGORIES as readonly string[]).includes(paramCat) ? paramCat : null;
    setSelectedCategory(next);
  }, [paramCat]);

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
      supabase
        .from('profiles')
        .select('location_lat, location_lng, postal_code')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
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
    }, [user?.id])
  );

  const categoriesForQuery = useMemo(
    () => (selectedCategory ? [selectedCategory] : [] as string[]),
    [selectedCategory]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchWorkshopEvents({
        searchTerm,
        categories: categoriesForQuery,
        dateRangeStart: null,
        dateRangeEnd: null,
      });
      setEvents(rows);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoriesForQuery]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    setListPage(1);
  }, [selectedYmd, selectedCategory, searchTerm]);

  const dayEvents = useMemo(() => {
    if (selectedYmd != null) {
      return events.filter((e) => eventMatchesCalendarDay(e, selectedYmd));
    }
    const upcoming = events.filter(eventIsUpcomingToronto);
    return [...upcoming].sort((a, b) => eventSortMs(a) - eventSortMs(b));
  }, [events, selectedYmd]);

  const groupedForDay = useMemo(() => {
    const mode = selectedYmd != null ? 'single-day' : 'all-dates';
    const map = new Map<string, WorkshopEventRow[]>();
    for (const e of dayEvents) {
      const k = browseGroupKey(e, mode);
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    const groups = [...map.values()].map((g) => [...g].sort((a, b) => eventSortMs(a) - eventSortMs(b)));
    groups.sort((a, b) => eventSortMs(a[0]!) - eventSortMs(b[0]!));
    return groups;
  }, [dayEvents, selectedYmd]);

  const pagedGroups = useMemo(
    () => groupedForDay.slice(0, listPage * WORKSHOP_LIST_PAGE_SIZE),
    [groupedForDay, listPage]
  );

  const syncParams = (next: { q?: string; categories?: string | null }) => {
    router.setParams({
      q: next.q || undefined,
      categories: next.categories || undefined,
    });
  };

  const selectCategory = (cat: string | null) => {
    setSelectedCategory(cat);
    syncParams({
      q: searchTerm,
      categories: cat,
    });
  };

  const pushSearch = () => {
    const p = new URLSearchParams();
    if (searchTerm) p.set('q', searchTerm);
    if (selectedCategory) p.set('categories', selectedCategory);
    const qs = p.toString();
    router.push(qs ? `/workshop-search?${qs}` : '/workshop-search');
  };

  const pillCategories = useMemo(() => ['All', ...CATEGORIES] as const, []);

  return (
    <View style={{ flex: 1, backgroundColor: DesignColors.creamBg, paddingBottom: insets.bottom }}>
      <WorkshopsChrome
        showBack
        hideDateAndClear
        onBackPress={() => router.back()}
        searchAsButton
        searchPlaceholder="Search workshops…"
        searchValue={searchTerm}
        onSearchPress={pushSearch}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: DesignSpacing.horizontalPadding,
          paddingBottom: 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}>
            {pillCategories.map((label) => {
              const isAll = label === 'All';
              const active = isAll ? selectedCategory == null : selectedCategory === label;
              return (
                <Pressable
                  key={label}
                  onPress={() => selectCategory(isAll ? null : label)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 9999,
                    backgroundColor: active ? DesignColors.primary : DesignColors.inputBg,
                    borderWidth: 1,
                    borderColor: DesignColors.lightGreenBorder,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: active ? '#FFF' : DesignColors.charcoal,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}>
            <Pressable
              onPress={() => setSelectedYmd(null)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: selectedYmd == null ? DesignColors.heroBg : DesignColors.inputBg,
                borderWidth: 1,
                borderColor: selectedYmd == null ? DesignColors.primary : DesignColors.lightGreenBorder,
                minWidth: 72,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: selectedYmd == null ? DesignColors.primary : DesignColors.charcoal,
                  textAlign: 'center',
                }}
                numberOfLines={2}
              >
                All
              </Text>
            </Pressable>
            {strip.map((d) => {
              const active = d.ymd === selectedYmd;
              return (
                <Pressable
                  key={d.ymd}
                  onPress={() => setSelectedYmd(d.ymd)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: active ? DesignColors.heroBg : DesignColors.inputBg,
                    borderWidth: 1,
                    borderColor: active ? DesignColors.primary : DesignColors.lightGreenBorder,
                    minWidth: 72,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: active ? DesignColors.primary : DesignColors.charcoal,
                      textAlign: 'center',
                    }}
                    numberOfLines={2}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={DesignColors.primary} />
          </View>
        ) : (
          <>
            <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 12 }}>
              {groupedForDay.length} workshop{groupedForDay.length === 1 ? '' : 's'}
              {selectedYmd == null ? ' upcoming' : ' on this day'}
            </Text>
            <View style={{ gap: LIST_GAP }}>
              {pagedGroups.map((group) => {
                const anchor = group[0]!;
                return (
                  <View key={`${anchor.vendor_id ?? 'nv'}-${anchor.title}-${group.map((g) => g.id).join('-')}`} style={{ width: '100%' }}>
                    <WorkshopBrowseGroupedCard
                      group={group}
                      profileLocation={profileLocation}
                      savedEventIds={savedEventIds}
                      onSaveChange={(id, saved) => {
                        setSavedEventIds((prev) => {
                          const next = new Set(prev);
                          if (saved) next.add(id);
                          else next.delete(id);
                          return next;
                        });
                      }}
                    />
                  </View>
                );
              })}
            </View>
            {dayEvents.length === 0 ? (
              <Text style={{ color: DesignColors.mediumGray, marginTop: 8 }}>
                {selectedYmd == null ? 'No upcoming workshops.' : 'Nothing scheduled for this day.'}
              </Text>
            ) : null}
            {pagedGroups.length < groupedForDay.length ? (
              <Pressable
                onPress={() => setListPage((p) => p + 1)}
                style={{
                  marginTop: 20,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: DesignColors.lightGreenBorder,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.primary }}>Load more</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
