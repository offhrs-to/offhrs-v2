import WorkshopFilterBottomSheet, {
  WorkshopFilterRadioRow,
} from '@/components/WorkshopFilterBottomSheet';
import { CATEGORIES } from '@/constants/categories';
import { DesignColors } from '@/constants/design-template';
import {
  BROWSE_DISTANCE_OPTIONS,
  type BrowseDistanceKm,
  type BrowseListSort,
} from '@/lib/workshop-browse-filters';
import type { WorkshopPriceSort } from '@/lib/workshop-price-sort';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

type Sheet = 'category' | 'sort' | 'distance' | 'all' | null;

type Props = {
  open: Sheet;
  onClose: () => void;
  selectedCategories: string[];
  onToggleCategory: (cat: string) => void;
  onClearCategories: () => void;
  onClearAllFilters: () => void;
  listSort: BrowseListSort;
  onSelectListSort: (s: BrowseListSort) => void;
  distanceKm: BrowseDistanceKm;
  onSelectDistanceKm: (d: BrowseDistanceKm) => void;
  priceSort: WorkshopPriceSort;
  onSelectPriceSort: (p: WorkshopPriceSort) => void;
  hasProfileLocation: boolean;
};

function DoneFooter({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 13,
        borderRadius: 12,
        backgroundColor: DesignColors.primary,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>Done</Text>
    </Pressable>
  );
}

function WorkshopBrowseFilterSheets({
  open,
  onClose,
  selectedCategories,
  onToggleCategory,
  onClearCategories,
  onClearAllFilters,
  listSort,
  onSelectListSort,
  distanceKm,
  onSelectDistanceKm,
  priceSort,
  onSelectPriceSort,
  hasProfileLocation,
}: Props) {
  return (
    <>
      <WorkshopFilterBottomSheet
        visible={open === 'category'}
        onClose={onClose}
        title="Category"
        subtitle="Select one or more experience types."
        footer={<DoneFooter onPress={onClose} />}
      >
        <WorkshopFilterRadioRow
          label="All categories"
          selected={selectedCategories.length === 0}
          showDivider
          checkbox
          onPress={onClearCategories}
        />
        {CATEGORIES.map((cat) => (
          <WorkshopFilterRadioRow
            key={cat}
            label={cat}
            selected={selectedCategories.includes(cat)}
            checkbox
            onPress={() => onToggleCategory(cat)}
          />
        ))}
      </WorkshopFilterBottomSheet>

      <WorkshopFilterBottomSheet
        visible={open === 'sort'}
        onClose={onClose}
        title="Sort results by"
      >
        <WorkshopFilterRadioRow
          label="Time — Earliest First"
          selected={listSort === 'time' && priceSort === 'default'}
          onPress={() => {
            onSelectPriceSort('default');
            onSelectListSort('time');
            onClose();
          }}
        />
        <WorkshopFilterRadioRow
          label="Distance — Nearest First"
          selected={listSort === 'distance' && priceSort === 'default'}
          onPress={() => {
            onSelectPriceSort('default');
            onSelectListSort('distance');
            onClose();
          }}
        />
      </WorkshopFilterBottomSheet>

      <WorkshopFilterBottomSheet
        visible={open === 'distance'}
        onClose={onClose}
        title="Distance from current location"
        subtitle={
          hasProfileLocation
            ? 'Filtered results will be displayed relative to your saved location.'
            : 'Add a saved location in your profile to filter by distance.'
        }
      >
        {BROWSE_DISTANCE_OPTIONS.map((opt) => (
          <WorkshopFilterRadioRow
            key={String(opt.value)}
            label={opt.label}
            selected={distanceKm === opt.value}
            showDivider={opt.value === 'auto'}
            onPress={() => {
              onSelectDistanceKm(opt.value);
              onClose();
            }}
          />
        ))}
      </WorkshopFilterBottomSheet>

      <WorkshopFilterBottomSheet
        visible={open === 'all'}
        onClose={onClose}
        title="Filters"
        subtitle="Adjust category, sort, distance, and price."
        maxHeightRatio={0.78}
        footer={<DoneFooter onPress={onClose} />}
      >
        <Pressable
          onPress={onClearAllFilters}
          accessibilityRole="button"
          accessibilityLabel="Clear all filters"
          style={{
            marginHorizontal: 12,
            marginTop: 4,
            marginBottom: 8,
            paddingVertical: 11,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: DesignColors.lightGreenBorder,
            backgroundColor: DesignColors.inputBg,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.primary }}>
            Clear all filters
          </Text>
        </Pressable>

        <SectionTitle>Category</SectionTitle>
        <WorkshopFilterRadioRow
          label="All categories"
          selected={selectedCategories.length === 0}
          showDivider
          checkbox
          onPress={onClearCategories}
        />
        {CATEGORIES.map((cat) => (
          <WorkshopFilterRadioRow
            key={cat}
            label={cat}
            selected={selectedCategories.includes(cat)}
            checkbox
            onPress={() => onToggleCategory(cat)}
          />
        ))}

        <SectionTitle accentLine>Sort</SectionTitle>
        <WorkshopFilterRadioRow
          label="Time — Earliest First"
          selected={listSort === 'time' && priceSort === 'default'}
          onPress={() => {
            onSelectPriceSort('default');
            onSelectListSort('time');
          }}
        />
        <WorkshopFilterRadioRow
          label="Distance — Nearest First"
          selected={listSort === 'distance' && priceSort === 'default'}
          onPress={() => {
            onSelectPriceSort('default');
            onSelectListSort('distance');
          }}
        />
        <WorkshopFilterRadioRow
          label="Price — Highest to Lowest"
          selected={priceSort === 'price_high'}
          onPress={() => onSelectPriceSort('price_high')}
        />
        <WorkshopFilterRadioRow
          label="Price — Lowest to Highest"
          selected={priceSort === 'price_low'}
          onPress={() => onSelectPriceSort('price_low')}
        />

        <SectionTitle>Distance radius</SectionTitle>
        {BROWSE_DISTANCE_OPTIONS.map((opt) => (
          <WorkshopFilterRadioRow
            key={`all-${String(opt.value)}`}
            label={opt.label}
            selected={distanceKm === opt.value}
            showDivider={opt.value === 'auto'}
            onPress={() => onSelectDistanceKm(opt.value)}
          />
        ))}
      </WorkshopFilterBottomSheet>
    </>
  );
}

function SectionTitle({ children, accentLine }: { children: string; accentLine?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 16, paddingBottom: accentLine ? 8 : 4 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: DesignColors.mediumGray,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {children}
      </Text>
      {accentLine ? (
        <View
          style={{
            height: 1,
            marginTop: 8,
            backgroundColor: DesignColors.lightGreenBorder,
          }}
        />
      ) : null}
    </View>
  );
}

export default memo(WorkshopBrowseFilterSheets);
