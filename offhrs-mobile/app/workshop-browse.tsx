import WorkshopBrowseFilterSheets from '@/components/WorkshopBrowseFilterSheets';
import WorkshopBrowseGroupedCard from '@/components/WorkshopBrowseGroupedCard';
import WorkshopDateRangeModal from '@/components/WorkshopDateRangeModal';
import WorkshopFilterPill from '@/components/WorkshopFilterPill';
import WorkshopQuickViewModal from '@/components/WorkshopQuickViewModal';
import WorkshopsChrome from '@/components/WorkshopsChrome';
import { CATEGORIES } from '@/constants/categories';
import { DesignColors, DesignSpacing } from '@/constants/design-template';
import { WORKSHOP_LIST_PAGE_SIZE } from '@/constants/workshops-list';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  browseFiltersAreActive,
  categoryPillLabel,
  distancePillLabel,
  eventMatchesYmdRange,
  filterGroupsByDistanceRadius,
  normalizeCalendarSelection,
  parseCategoriesParam,
  serializeCategoriesParam,
  sortPillLabel,
  sortWorkshopGroupsForBrowse,
  type BrowseDistanceKm,
  type BrowseListSort,
} from '@/lib/workshop-browse-filters';
import { buildDateStrip, eventMatchesCalendarDay, getTorontoYmd } from '@/lib/workshop-calendar';
import type { WorkshopEventRow } from '@/lib/workshops-events-query';
import { fetchWorkshopEvents } from '@/lib/workshops-events-query';
import { compareWorkshopEventsByStart, workshopEventTorontoYmd } from '@/lib/workshop-event-sort';
import type { WorkshopPriceSort } from '@/lib/workshop-price-sort';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LIST_GAP = 12;

function parseParamString(v: string | string[] | undefined): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : v[0] ?? '';
}

/** Same workshop listing (vendor + title) on the same calendar day → one card with multiple time pills. */
function workshopGroupKey(e: WorkshopEventRow): string {
  const v = e.vendor_id ?? '';
  const t = e.title.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${v}\u0001${t}`;
}

function eventIsUpcomingToronto(e: WorkshopEventRow): boolean {
  if (e.recurrence === 'daily' || e.recurrence === 'weekly') return true;
  const eventYmd = workshopEventTorontoYmd(e);
  return eventYmd !== '' && eventYmd >= getTorontoYmd();
}

function browseGroupKey(e: WorkshopEventRow, mode: 'single-day' | 'all-dates'): string {
  if (mode === 'single-day') return workshopGroupKey(e);
  if (e.recurrence === 'daily' || e.recurrence === 'weekly') return `rec:${e.id}`;
  if (e.workshop_series === 'multi_week') return `series:${e.id}`;
  const ymd = workshopEventTorontoYmd(e);
  return `${ymd}\u0001${workshopGroupKey(e)}`;
}

type FilterSheet = 'category' | 'sort' | 'distance' | 'all' | null;

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
  const initialCategories = parseCategoriesParam(paramCat, CATEGORIES);

  const [searchTerm, setSearchTerm] = useState(paramQ);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategories);

  const strip = useMemo(() => buildDateStrip(90), []);
  /** `null` = show all upcoming dates (or calendar range), chronological (soonest first). */
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);

  const [listSort, setListSort] = useState<BrowseListSort>('time');
  const [distanceKm, setDistanceKm] = useState<BrowseDistanceKm>('auto');
  const [priceSort, setPriceSort] = useState<WorkshopPriceSort>('default');

  const [filterSheet, setFilterSheet] = useState<FilterSheet>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<WorkshopEventRow[]>([]);
  const [listPage, setListPage] = useState(1);

  const [savedEventIds, setSavedEventIds] = useState<Set<number>>(new Set());
  const [quickViewEvent, setQuickViewEvent] = useState<WorkshopEventRow | null>(null);
  const [quickViewSaving, setQuickViewSaving] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);

  const [profileLocation, setProfileLocation] = useState<{
    lat: number;
    lng: number;
    postal_code: string | null;
  } | null>(null);

  useEffect(() => {
    setSearchTerm(paramQ);
  }, [paramQ]);

  useEffect(() => {
    setSelectedCategories(parseCategoriesParam(paramCat, CATEGORIES));
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
    }, [user?.id])
  );

  const quickViewEventId = quickViewEvent?.id != null ? Number(quickViewEvent.id) : null;
  const quickViewSaved =
    quickViewEventId != null && Number.isInteger(quickViewEventId) && savedEventIds.has(quickViewEventId);

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

  const categoriesForQuery = selectedCategories;

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
  }, [selectedYmd, selectedCategories, searchTerm, priceSort, listSort, distanceKm, rangeStart, rangeEnd]);

  const dayEvents = useMemo(() => {
    if (rangeStart || rangeEnd) {
      return events.filter((e) => eventMatchesYmdRange(e, rangeStart, rangeEnd));
    }
    if (selectedYmd != null) {
      return events.filter((e) => eventMatchesCalendarDay(e, selectedYmd));
    }
    const upcoming = events.filter(eventIsUpcomingToronto);
    return [...upcoming].sort(compareWorkshopEventsByStart);
  }, [events, selectedYmd, rangeStart, rangeEnd]);

  const profileAnchor = useMemo(
    () => (profileLocation ? { lat: profileLocation.lat, lng: profileLocation.lng } : null),
    [profileLocation]
  );

  const groupedForDay = useMemo(() => {
    const mode = selectedYmd != null && !rangeStart && !rangeEnd ? 'single-day' : 'all-dates';
    const map = new Map<string, WorkshopEventRow[]>();
    for (const e of dayEvents) {
      const k = browseGroupKey(e, mode);
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    let groups = [...map.values()].map((g) => [...g].sort(compareWorkshopEventsByStart));
    groups = filterGroupsByDistanceRadius(groups, distanceKm, profileAnchor);
    return sortWorkshopGroupsForBrowse(groups, listSort, priceSort, profileAnchor);
  }, [dayEvents, selectedYmd, rangeStart, rangeEnd, distanceKm, listSort, priceSort, profileAnchor]);

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

  const toggleCategory = (cat: string) => {
    const next = selectedCategories.includes(cat)
      ? selectedCategories.filter((c) => c !== cat)
      : [...selectedCategories, cat];
    setSelectedCategories(next);
    syncParams({
      q: searchTerm,
      categories: serializeCategoriesParam(next, CATEGORIES),
    });
  };

  const clearCategories = () => {
    setSelectedCategories([]);
    syncParams({ q: searchTerm, categories: null });
  };

  const pushSearch = () => {
    const p = new URLSearchParams();
    if (searchTerm) p.set('q', searchTerm);
    const cats = serializeCategoriesParam(selectedCategories, CATEGORIES);
    if (cats) p.set('categories', cats);
    const qs = p.toString();
    router.push(qs ? `/workshop-search?${qs}` : '/workshop-search');
  };

  const calendarActive = selectedYmd != null || rangeStart != null || rangeEnd != null;
  const filtersActive = browseFiltersAreActive({
    selectedCategories,
    listSort,
    distanceKm,
    priceSort,
    selectedYmd,
    rangeStart,
    rangeEnd,
  });

  const openDistanceSheet = () => {
    if (!profileLocation && distanceKm === 'auto') {
      // Still allow opening so they can see options; filtering no-ops without location.
    }
    setFilterSheet('distance');
  };

  return (
    <>
      <View style={{ flex: 1, backgroundColor: DesignColors.creamBg, paddingBottom: insets.bottom }}>
        <WorkshopsChrome
          showBack
          hideDateAndClear
          onBackPress={() => router.back()}
          searchAsButton
          searchPlaceholder="Search workshops…"
          searchValue={searchTerm}
          onSearchPress={pushSearch}
          showAllFiltersButton
          allFiltersActive={filtersActive}
          onAllFiltersPress={() => setFilterSheet('all')}
        />

        {/* Sticky filter panel — stays visible while the list scrolls */}
        <View
          style={{
            flexShrink: 0,
            backgroundColor: DesignColors.creamBg,
            paddingHorizontal: DesignSpacing.horizontalPadding,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: DesignColors.lightGreenBorder,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginBottom: 8,
            }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <WorkshopFilterPill
                label={categoryPillLabel(selectedCategories)}
                active={selectedCategories.length > 0}
                onPress={() => setFilterSheet('category')}
                style={{ flex: 1 }}
              />
              <WorkshopFilterPill
                label={sortPillLabel(listSort, priceSort)}
                active={listSort !== 'time' || priceSort !== 'default'}
                onPress={() => setFilterSheet('sort')}
                style={{ flex: 1 }}
              />
              <WorkshopFilterPill
                label={distancePillLabel(distanceKm)}
                active={distanceKm !== 'auto'}
                onPress={openDistanceSheet}
                style={{ flex: 1 }}
              />
            </View>
            <Pressable
              onPress={() => setCalendarOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Filter by date"
              style={{
                width: 36,
                height: 36,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 9999,
                backgroundColor: calendarActive ? DesignColors.heroBg : DesignColors.inputBg,
                borderWidth: 1,
                borderColor: calendarActive ? DesignColors.primary : DesignColors.lightGreenBorder,
              }}
            >
              <MaterialCommunityIcons
                name="calendar-month-outline"
                size={20}
                color={calendarActive ? DesignColors.primary : DesignColors.sageGreen}
              />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}>
              <Pressable
                onPress={() => {
                  setSelectedYmd(null);
                  setRangeStart(null);
                  setRangeEnd(null);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor:
                    selectedYmd == null && !rangeStart && !rangeEnd
                      ? DesignColors.heroBg
                      : DesignColors.inputBg,
                  borderWidth: 1,
                  borderColor:
                    selectedYmd == null && !rangeStart && !rangeEnd
                      ? DesignColors.primary
                      : DesignColors.lightGreenBorder,
                  minWidth: 72,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color:
                      selectedYmd == null && !rangeStart && !rangeEnd
                        ? DesignColors.primary
                        : DesignColors.charcoal,
                    textAlign: 'center',
                  }}
                  numberOfLines={2}
                >
                  All
                </Text>
              </Pressable>
              {strip.map((d) => {
                const active = rangeStart == null && rangeEnd == null && d.ymd === selectedYmd;
                return (
                  <Pressable
                    key={d.ymd}
                    onPress={() => {
                      setRangeStart(null);
                      setRangeEnd(null);
                      setSelectedYmd(d.ymd);
                    }}
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
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: DesignSpacing.horizontalPadding,
            paddingTop: 12,
            paddingBottom: 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          {rangeStart || rangeEnd ? (
            <Text style={{ fontSize: 12, color: DesignColors.mediumGray, marginBottom: 10 }}>
              Date range: {rangeStart ?? '…'} → {rangeEnd ?? '…'}
            </Text>
          ) : null}

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={DesignColors.primary} />
            </View>
          ) : (
            <>
              <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 12 }}>
                {groupedForDay.length} workshop{groupedForDay.length === 1 ? '' : 's'}
                {selectedYmd == null && !rangeStart && !rangeEnd
                  ? ' upcoming'
                  : selectedYmd != null
                    ? ' on this day'
                    : ' in this date range'}
              </Text>
              <View style={{ gap: LIST_GAP }}>
                {pagedGroups.map((group) => {
                  const anchor = group[0]!;
                  return (
                    <View
                      key={`${anchor.vendor_id ?? 'nv'}-${anchor.title}-${group.map((g) => g.id).join('-')}`}
                      style={{ width: '100%' }}
                    >
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
                        onOpenQuickView={setQuickViewEvent}
                      />
                    </View>
                  );
                })}
              </View>
              {dayEvents.length === 0 || groupedForDay.length === 0 ? (
                <Text style={{ color: DesignColors.mediumGray, marginTop: 8 }}>
                  {distanceKm !== 'auto' && profileLocation == null
                    ? 'Add a saved location in your profile to filter by distance.'
                    : selectedYmd == null && !rangeStart && !rangeEnd
                      ? 'No upcoming workshops.'
                      : 'Nothing scheduled for this selection.'}
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

      <WorkshopBrowseFilterSheets
        open={filterSheet}
        onClose={() => setFilterSheet(null)}
        selectedCategories={selectedCategories}
        onToggleCategory={toggleCategory}
        onClearCategories={clearCategories}
        listSort={listSort}
        onSelectListSort={setListSort}
        distanceKm={distanceKm}
        onSelectDistanceKm={setDistanceKm}
        priceSort={priceSort}
        onSelectPriceSort={setPriceSort}
        hasProfileLocation={!!profileLocation}
      />

      <WorkshopDateRangeModal
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        initialStart={rangeStart ?? selectedYmd ?? ''}
        initialEnd={rangeEnd ?? selectedYmd ?? ''}
        onApply={(start, end) => {
          const next = normalizeCalendarSelection(start, end);
          setSelectedYmd(next.selectedYmd);
          setRangeStart(next.rangeStart);
          setRangeEnd(next.rangeEnd);
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
        profileLocation={profileLocation ? { lat: profileLocation.lat, lng: profileLocation.lng } : null}
        profilePostalCode={profileLocation?.postal_code ?? null}
        onBookingComplete={reload}
      />
    </>
  );
}
