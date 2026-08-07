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
import {
  patchSavedEventIds,
  subscribeEventSavesChanged,
  toggleUserEventSave,
} from '@/lib/event-saves';
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
import { memo, useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  InteractionManager,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LIST_GAP = 12;

function parseParamString(v: string | string[] | undefined): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : v[0] ?? '';
}

/** Comma-separated event IDs from home carousel “see all” (preserves order). */
function parseEventIdsParam(v: string | string[] | undefined): number[] {
  const raw = parseParamString(v);
  if (!raw.trim()) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const part of raw.split(',')) {
    const n = Number(part.trim());
    if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** Same workshop listing on the same calendar day → one card with multiple time pills. */
function workshopGroupKey(e: WorkshopEventRow): string {
  // Shopify: one product → many variants/times; group by product id, not title.
  if (e.shopify_product_id) {
    const vp = e.vendor_profile_id ?? e.vendor_id ?? ''
    return `shopify\u0001${vp}\u0001${e.shopify_product_id}`
  }
  const v = e.vendor_id ?? ''
  const t = e.title.trim().toLowerCase().replace(/\s+/g, ' ')
  return `${v}\u0001${t}`
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

function browseGroupListKey(group: WorkshopEventRow[]): string {
  const anchor = group[0];
  if (!anchor) return 'empty';
  return `${anchor.vendor_id ?? 'nv'}-${anchor.title}-${group.map((g) => g.id).join('-')}`;
}

type FilterPillsRowProps = {
  categoryLabel: string;
  categoryActive: boolean;
  sortLabel: string;
  sortActive: boolean;
  distanceLabel: string;
  distanceActive: boolean;
  calendarActive: boolean;
  onOpenFilterSheet: (sheet: Exclude<FilterSheet, null>) => void;
  onOpenCalendar: () => void;
};

/**
 * Category/sort/distance pills + calendar toggle. Memoized so tapping elsewhere in the
 * screen (search, list scroll, data reload) doesn't force these ~5 controls to re-render.
 */
const FilterPillsRow = memo(function FilterPillsRow({
  categoryLabel,
  categoryActive,
  sortLabel,
  sortActive,
  distanceLabel,
  distanceActive,
  calendarActive,
  onOpenFilterSheet,
  onOpenCalendar,
}: FilterPillsRowProps) {
  return (
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
          label={categoryLabel}
          active={categoryActive}
          onPress={() => onOpenFilterSheet('category')}
          style={{ flex: 1 }}
        />
        <WorkshopFilterPill
          label={sortLabel}
          active={sortActive}
          onPress={() => onOpenFilterSheet('sort')}
          style={{ flex: 1 }}
        />
        <WorkshopFilterPill
          label={distanceLabel}
          active={distanceActive}
          onPress={() => onOpenFilterSheet('distance')}
          style={{ flex: 1 }}
        />
      </View>
      <Pressable
        onPress={onOpenCalendar}
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
  );
});

type DateStripBarProps = {
  strip: ReturnType<typeof buildDateStrip>;
  selectedYmd: string | null;
  rangeStart: string | null;
  rangeEnd: string | null;
  onSelectAll: () => void;
  onSelectDay: (ymd: string) => void;
};

/**
 * Horizontal "All" + rolling 90-day strip. Memoized so its ~90 Pressables are only
 * rebuilt when the selection actually changes, not on every unrelated screen re-render.
 */
const DateStripBar = memo(function DateStripBar({
  strip,
  selectedYmd,
  rangeStart,
  rangeEnd,
  onSelectAll,
  onSelectDay,
}: DateStripBarProps) {
  const allActive = selectedYmd == null && !rangeStart && !rangeEnd;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}>
        <Pressable
          onPress={onSelectAll}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: allActive ? DesignColors.heroBg : DesignColors.inputBg,
            borderWidth: 1,
            borderColor: allActive ? DesignColors.primary : DesignColors.lightGreenBorder,
            minWidth: 72,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: allActive ? DesignColors.primary : DesignColors.charcoal,
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
              onPress={() => onSelectDay(d.ymd)}
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
  );
});

type BrowseListProps = {
  loading: boolean;
  groupedCount: number;
  pagedGroups: WorkshopEventRow[][];
  dayEventsCount: number;
  selectedYmd: string | null;
  rangeStart: string | null;
  rangeEnd: string | null;
  distanceKm: BrowseDistanceKm;
  profileLocation: { lat: number; lng: number; postal_code: string | null } | null;
  savedEventIds: Set<number>;
  onLoadMore: () => void;
  onSaveChange: (eventId: number, saved: boolean) => void;
  onOpenQuickView: (row: WorkshopEventRow) => void;
};

const BrowseWorkshopList = memo(function BrowseWorkshopList({
  loading,
  groupedCount,
  pagedGroups,
  dayEventsCount,
  selectedYmd,
  rangeStart,
  rangeEnd,
  distanceKm,
  profileLocation,
  savedEventIds,
  onLoadMore,
  onSaveChange,
  onOpenQuickView,
}: BrowseListProps) {
  const renderItem = useCallback(
    ({ item: group }: { item: WorkshopEventRow[] }) => (
      <View style={{ width: '100%', marginBottom: LIST_GAP }}>
        <WorkshopBrowseGroupedCard
          group={group}
          profileLocation={profileLocation}
          savedEventIds={savedEventIds}
          onSaveChange={onSaveChange}
          onOpenQuickView={onOpenQuickView}
        />
      </View>
    ),
    [profileLocation, savedEventIds, onSaveChange, onOpenQuickView]
  );

  const keyExtractor = useCallback((group: WorkshopEventRow[]) => browseGroupListKey(group), []);

  const listHeader = useMemo(
    () => (
      <View>
        {rangeStart || rangeEnd ? (
          <Text style={{ fontSize: 12, color: DesignColors.mediumGray, marginBottom: 10 }}>
            Date range: {rangeStart ?? '…'} → {rangeEnd ?? '…'}
          </Text>
        ) : null}
        <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 12 }}>
          {groupedCount} workshop{groupedCount === 1 ? '' : 's'}
          {selectedYmd == null && !rangeStart && !rangeEnd
            ? ' upcoming'
            : selectedYmd != null
              ? ' on this day'
              : ' in this date range'}
        </Text>
      </View>
    ),
    [groupedCount, selectedYmd, rangeStart, rangeEnd]
  );

  if (loading && pagedGroups.length === 0) {
    return (
      <View style={{ flex: 1, paddingVertical: 40, alignItems: 'center' }}>
        <ActivityIndicator color={DesignColors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1 }}
      data={pagedGroups}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={listHeader}
      contentContainerStyle={{
        paddingHorizontal: DesignSpacing.horizontalPadding,
        paddingTop: 12,
        paddingBottom: 32,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      initialNumToRender={8}
      maxToRenderPerBatch={6}
      windowSize={7}
      ListEmptyComponent={
        dayEventsCount === 0 || groupedCount === 0 ? (
          <Text style={{ color: DesignColors.mediumGray, marginTop: 8 }}>
            {distanceKm !== 'auto' && profileLocation == null
              ? 'Add a saved location in your profile to filter by distance.'
              : selectedYmd == null && !rangeStart && !rangeEnd
                ? 'No upcoming workshops.'
                : 'Nothing scheduled for this selection.'}
          </Text>
        ) : null
      }
      ListFooterComponent={
        pagedGroups.length < groupedCount ? (
          <Pressable
            onPress={onLoadMore}
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
        ) : null
      }
    />
  );
});

export default function WorkshopBrowseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    q?: string;
    categories?: string;
    ids?: string;
    heading?: string;
    sort?: string;
  }>();

  const paramQ = parseParamString(params.q);
  const paramCat = parseParamString(params.categories);
  const pinnedEventIds = useMemo(() => parseEventIdsParam(params.ids), [params.ids]);
  const browseHeading = parseParamString(params.heading).trim();
  const paramSort = parseParamString(params.sort);
  const initialListSort: BrowseListSort = paramSort === 'distance' ? 'distance' : 'time';
  const initialCategories = parseCategoriesParam(paramCat, CATEGORIES);

  const [searchTerm, setSearchTerm] = useState(paramQ);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategories);

  const strip = useMemo(() => buildDateStrip(90), []);
  /** `null` = show all upcoming dates (or calendar range), chronological (soonest first). */
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);

  const [listSort, setListSort] = useState<BrowseListSort>(initialListSort);
  const [distanceKm, setDistanceKm] = useState<BrowseDistanceKm>('auto');
  const [priceSort, setPriceSort] = useState<WorkshopPriceSort>('default');

  const [filterSheet, setFilterSheet] = useState<FilterSheet>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<WorkshopEventRow[]>([]);
  const eventsCountRef = useRef(0);
  eventsCountRef.current = events.length;
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

  useEffect(() => {
    if (paramSort === 'distance' || paramSort === 'time') {
      startTransition(() => setListSort(paramSort));
    }
  }, [paramSort]);

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

  useEffect(() => {
    return subscribeEventSavesChanged(({ eventId, saved }) => {
      setSavedEventIds((prev) => patchSavedEventIds(prev, eventId, saved));
    });
  }, []);

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
  }, [quickViewEvent?.id, quickViewSaving, router, savedEventIds, user?.id]);

  const categoriesForQuery = selectedCategories;

  const handleSaveChange = useCallback((eventId: number, saved: boolean) => {
    setSavedEventIds((prev) => patchSavedEventIds(prev, eventId, saved));
  }, []);

  const openQuickView = useCallback((row: WorkshopEventRow) => {
    setQuickViewEvent(row);
  }, []);

  const loadMoreGroups = useCallback(() => {
    startTransition(() => setListPage((p) => p + 1));
  }, []);

  const reload = useCallback(async () => {
    if (eventsCountRef.current === 0) setLoading(true);
    try {
      const rows = await fetchWorkshopEvents({
        searchTerm,
        // Category is filtered client-side so toggling filters stays instant.
        categories: [],
        dateRangeStart: null,
        dateRangeEnd: null,
        light: true,
        onPartial: (partial) => {
          startTransition(() => {
            setEvents(partial);
            setLoading(false);
          });
        },
      });
      InteractionManager.runAfterInteractions(() => {
        setEvents(rows);
        setLoading(false);
      });
    } catch {
      setEvents([]);
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    startTransition(() => setListPage(1));
  }, [selectedYmd, selectedCategories, searchTerm, priceSort, listSort, distanceKm, rangeStart, rangeEnd]);

  const eventsForBrowse = useMemo(() => {
    let scoped = events;
    if (pinnedEventIds.length > 0) {
      const byId = new Map(events.map((e) => [Number(e.id), e]));
      scoped = pinnedEventIds
        .map((id) => byId.get(id))
        .filter((e): e is WorkshopEventRow => e != null);
    }
    if (categoriesForQuery.length === 0) return scoped;
    const allowed = new Set(categoriesForQuery);
    return scoped.filter((e) => e.category != null && allowed.has(e.category));
  }, [events, categoriesForQuery, pinnedEventIds]);

  const dayEvents = useMemo(() => {
    if (rangeStart || rangeEnd) {
      return eventsForBrowse.filter((e) => eventMatchesYmdRange(e, rangeStart, rangeEnd));
    }
    if (selectedYmd != null) {
      return eventsForBrowse.filter((e) => eventMatchesCalendarDay(e, selectedYmd));
    }
    const upcoming = eventsForBrowse.filter(eventIsUpcomingToronto);
    return [...upcoming].sort(compareWorkshopEventsByStart);
  }, [eventsForBrowse, selectedYmd, rangeStart, rangeEnd]);

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

  const syncParams = useCallback(
    (next: { q?: string; categories?: string | null; sort?: BrowseListSort }) => {
      const sortValue = next.sort ?? listSort;
      router.setParams({
        q: next.q || undefined,
        categories: next.categories || undefined,
        ids: pinnedEventIds.length > 0 ? pinnedEventIds.join(',') : undefined,
        heading: browseHeading || undefined,
        sort: sortValue === 'distance' ? 'distance' : undefined,
      });
    },
    [router, pinnedEventIds, browseHeading, listSort]
  );

  const toggleCategory = useCallback(
    (cat: string) => {
      const next = selectedCategories.includes(cat)
        ? selectedCategories.filter((c) => c !== cat)
        : [...selectedCategories, cat];
      startTransition(() => setSelectedCategories(next));
      syncParams({
        q: searchTerm,
        categories: serializeCategoriesParam(next, CATEGORIES),
      });
    },
    [selectedCategories, searchTerm, syncParams]
  );

  const clearCategories = useCallback(() => {
    startTransition(() => setSelectedCategories([]));
    syncParams({ q: searchTerm, categories: null });
  }, [searchTerm, syncParams]);

  const clearAllFilters = useCallback(() => {
    startTransition(() => {
      setSelectedCategories([]);
      setListSort('time');
      setPriceSort('default');
      setDistanceKm('auto');
    });
    syncParams({ q: searchTerm, categories: null, sort: 'time' });
  }, [searchTerm, syncParams]);

  const pushSearch = useCallback(() => {
    const p = new URLSearchParams();
    if (searchTerm) p.set('q', searchTerm);
    const cats = serializeCategoriesParam(selectedCategories, CATEGORIES);
    if (cats) p.set('categories', cats);
    const qs = p.toString();
    router.push(qs ? `/workshop-search?${qs}` : '/workshop-search');
  }, [searchTerm, selectedCategories, router]);

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

  const openFilterSheet = useCallback((sheet: Exclude<FilterSheet, null>) => {
    startTransition(() => setFilterSheet(sheet));
  }, []);

  const closeFilterSheet = useCallback(() => {
    startTransition(() => setFilterSheet(null));
  }, []);

  const applyListSort = useCallback(
    (sort: BrowseListSort) => {
      startTransition(() => setListSort(sort));
      syncParams({ q: searchTerm, categories: serializeCategoriesParam(selectedCategories, CATEGORIES), sort });
    },
    [searchTerm, selectedCategories, syncParams]
  );

  const applyDistanceKm = useCallback((km: BrowseDistanceKm) => {
    startTransition(() => setDistanceKm(km));
  }, []);

  const applyPriceSort = useCallback((sort: WorkshopPriceSort) => {
    startTransition(() => setPriceSort(sort));
  }, []);

  const openCalendar = useCallback(() => {
    startTransition(() => setCalendarOpen(true));
  }, []);

  const closeCalendar = useCallback(() => setCalendarOpen(false), []);

  const selectAllDates = useCallback(() => {
    startTransition(() => {
      setSelectedYmd(null);
      setRangeStart(null);
      setRangeEnd(null);
    });
  }, []);

  const selectDay = useCallback((ymd: string) => {
    startTransition(() => {
      setRangeStart(null);
      setRangeEnd(null);
      setSelectedYmd(ymd);
    });
  }, []);

  const applyCalendarRange = useCallback((start: string | null, end: string | null) => {
    const next = normalizeCalendarSelection(start, end);
    startTransition(() => {
      setSelectedYmd(next.selectedYmd);
      setRangeStart(next.rangeStart);
      setRangeEnd(next.rangeEnd);
    });
  }, []);

  const closeQuickView = useCallback(() => setQuickViewEvent(null), []);

  const goBack = useCallback(() => router.back(), [router]);

  const quickViewProfileLocation = useMemo(
    () => (profileLocation ? { lat: profileLocation.lat, lng: profileLocation.lng } : null),
    [profileLocation]
  );

  return (
    <>
      <View style={{ flex: 1, backgroundColor: DesignColors.creamBg, paddingBottom: insets.bottom }}>
        <WorkshopsChrome
          showBack
          hideDateAndClear
          onBackPress={goBack}
          searchAsButton
          searchPlaceholder={browseHeading || 'Search workshops…'}
          searchValue={searchTerm}
          onSearchPress={pushSearch}
          showAllFiltersButton
          allFiltersActive={filtersActive}
          onAllFiltersPress={() => openFilterSheet('all')}
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
          <FilterPillsRow
            categoryLabel={categoryPillLabel(selectedCategories)}
            categoryActive={selectedCategories.length > 0}
            sortLabel={sortPillLabel(listSort, priceSort)}
            sortActive={listSort !== 'time' || priceSort !== 'default'}
            distanceLabel={distancePillLabel(distanceKm)}
            distanceActive={distanceKm !== 'auto'}
            calendarActive={calendarActive}
            onOpenFilterSheet={openFilterSheet}
            onOpenCalendar={openCalendar}
          />

          <DateStripBar
            strip={strip}
            selectedYmd={selectedYmd}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onSelectAll={selectAllDates}
            onSelectDay={selectDay}
          />
        </View>

        <BrowseWorkshopList
          loading={loading}
          groupedCount={groupedForDay.length}
          pagedGroups={pagedGroups}
          dayEventsCount={dayEvents.length}
          selectedYmd={selectedYmd}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          distanceKm={distanceKm}
          profileLocation={profileLocation}
          savedEventIds={savedEventIds}
          onLoadMore={loadMoreGroups}
          onSaveChange={handleSaveChange}
          onOpenQuickView={openQuickView}
        />
      </View>

      <WorkshopBrowseFilterSheets
        open={filterSheet}
        onClose={closeFilterSheet}
        selectedCategories={selectedCategories}
        onToggleCategory={toggleCategory}
        onClearCategories={clearCategories}
        onClearAllFilters={clearAllFilters}
        listSort={listSort}
        onSelectListSort={applyListSort}
        distanceKm={distanceKm}
        onSelectDistanceKm={applyDistanceKm}
        priceSort={priceSort}
        onSelectPriceSort={applyPriceSort}
        hasProfileLocation={!!profileLocation}
      />

      <WorkshopDateRangeModal
        visible={calendarOpen}
        onClose={closeCalendar}
        initialStart={rangeStart ?? selectedYmd ?? ''}
        initialEnd={rangeEnd ?? selectedYmd ?? ''}
        onApply={applyCalendarRange}
      />

      <WorkshopQuickViewModal
        visible={!!quickViewEvent}
        event={quickViewEvent}
        onClose={closeQuickView}
        userId={user?.id}
        userEmail={user?.email ?? undefined}
        attendeeName={profileDisplayName ?? ''}
        saved={quickViewSaved}
        saving={quickViewSaving}
        onToggleSave={handleQuickViewSave}
        profileLocation={quickViewProfileLocation}
        profilePostalCode={profileLocation?.postal_code ?? null}
        onBookingComplete={reload}
      />
    </>
  );
}
