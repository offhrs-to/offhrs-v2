import { DesignColors, DesignSizes, DesignSpacing } from '@/constants/design-template';
import type { WorkshopPriceSort } from '@/lib/workshop-price-sort';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import WorkshopPriceSortMenu from '@/components/WorkshopPriceSortMenu';

export type WorkshopsChromeProps = {
  /** When true, search is a tappable row that calls onSearchPress (hub). */
  searchAsButton?: boolean;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChangeText?: (t: string) => void;
  onSearchPress?: () => void;
  /** Hides Date + Clear pills to the right of the search field. */
  hideDateAndClear?: boolean;
  onDatePress?: () => void;
  onClearPress?: () => void;
  hasDateFilter?: boolean;
  /** Optional back control for stack screens */
  showBack?: boolean;
  onBackPress?: () => void;
  /** Price sort filter dropdown (search list screens). */
  showPriceFilter?: boolean;
  priceSort?: WorkshopPriceSort;
  onPriceSortChange?: (sort: WorkshopPriceSort) => void;
  /** Browse: open consolidated filters bottom sheet. */
  showAllFiltersButton?: boolean;
  allFiltersActive?: boolean;
  onAllFiltersPress?: () => void;
  /** Stack screens (product detail, checkout): logo + optional back only. */
  hideSearchBar?: boolean;
};

export default function WorkshopsChrome({
  searchAsButton = false,
  searchPlaceholder = 'Search workshops…',
  searchValue,
  onSearchChangeText,
  onSearchPress,
  hideDateAndClear = false,
  onDatePress,
  onClearPress,
  hasDateFilter = false,
  showBack,
  onBackPress,
  showPriceFilter = false,
  priceSort = 'default',
  onPriceSortChange,
  showAllFiltersButton = false,
  allFiltersActive = false,
  onAllFiltersPress,
  hideSearchBar = false,
}: WorkshopsChromeProps) {
  const [priceMenuOpen, setPriceMenuOpen] = useState(false);
  const priceFilterActive = priceSort !== 'default';

  return (
    <>
      <View
        style={{
          paddingTop: DesignSpacing.contentPaddingTop,
          paddingBottom: DesignSpacing.logoHeaderPaddingBottom,
          paddingHorizontal: DesignSpacing.horizontalPadding,
          backgroundColor: DesignColors.creamBg,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
          <View style={{ marginLeft: DesignSpacing.logoMarginLeft }}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={{ height: DesignSizes.logoHeight, width: DesignSizes.logoWidth }}
              contentFit="contain"
            />
          </View>
        </View>
      </View>

      {!hideSearchBar ? (
      <View style={{ flexShrink: 0 }}>
        <View
          style={{
            paddingHorizontal: DesignSpacing.horizontalPadding,
            paddingTop: 0,
            paddingBottom: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {showBack ? (
            <Pressable
              onPress={onBackPress}
              hitSlop={12}
              style={{
                width: 32,
                height: 36,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: -2,
              }}
            >
              <Text style={{ fontSize: 22, color: DesignColors.primary }}>‹</Text>
            </Pressable>
          ) : null}
          {searchAsButton ? (
            <Pressable
              onPress={onSearchPress}
              style={{
                flex: 1,
                backgroundColor: DesignColors.inputBg,
                borderRadius: 9999,
                borderWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
                paddingHorizontal: 14,
                paddingVertical: 8,
                height: 36,
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: searchValue ? DesignColors.charcoal : DesignColors.mediumGray,
                }}
                numberOfLines={1}
              >
                {searchValue.trim() ? searchValue : searchPlaceholder}
              </Text>
            </Pressable>
          ) : (
            <TextInput
              placeholder={searchPlaceholder}
              placeholderTextColor={DesignColors.mediumGray}
              value={searchValue}
              onChangeText={onSearchChangeText}
              style={{
                flex: 1,
                backgroundColor: DesignColors.inputBg,
                borderRadius: 9999,
                borderWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
                paddingHorizontal: 14,
                paddingVertical: 8,
                height: 36,
                fontSize: 13,
                color: DesignColors.charcoal,
              }}
            />
          )}
          {!hideDateAndClear ? (
            <>
              <Pressable
                onPress={onDatePress}
                style={{
                  height: 36,
                  paddingHorizontal: 12,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: 9999,
                  backgroundColor: hasDateFilter ? DesignColors.primary : DesignColors.creamBg,
                  borderWidth: 1,
                  borderColor: DesignColors.lightGreenBorder,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: hasDateFilter ? '#FFF' : DesignColors.sageGreen,
                  }}
                >
                  Date
                </Text>
              </Pressable>
              <Pressable
                onPress={onClearPress}
                style={{
                  height: 36,
                  paddingHorizontal: 12,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: 9999,
                  backgroundColor: DesignColors.creamBg,
                  borderWidth: 1,
                  borderColor: DesignColors.lightGreenBorder,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: DesignColors.sageGreen }}>Clear</Text>
              </Pressable>
            </>
          ) : null}
          {showAllFiltersButton && onAllFiltersPress ? (
            <Pressable
              onPress={onAllFiltersPress}
              accessibilityRole="button"
              accessibilityLabel="All filters"
              style={{
                width: 36,
                height: 36,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 9999,
                backgroundColor: allFiltersActive ? DesignColors.heroBg : DesignColors.inputBg,
                borderWidth: 1,
                borderColor: allFiltersActive ? DesignColors.primary : DesignColors.lightGreenBorder,
              }}
            >
              <MaterialCommunityIcons
                name="filter-variant"
                size={20}
                color={allFiltersActive ? DesignColors.primary : DesignColors.sageGreen}
              />
            </Pressable>
          ) : null}
          {!showAllFiltersButton && showPriceFilter && onPriceSortChange ? (
            <Pressable
              onPress={() => setPriceMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Sort workshops by price"
              style={{
                width: 36,
                height: 36,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 9999,
                backgroundColor: priceFilterActive ? DesignColors.heroBg : DesignColors.inputBg,
                borderWidth: 1,
                borderColor: priceFilterActive ? DesignColors.primary : DesignColors.lightGreenBorder,
              }}
            >
              <MaterialCommunityIcons
                name="filter-variant"
                size={20}
                color={priceFilterActive ? DesignColors.primary : DesignColors.sageGreen}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
      ) : null}
      {!showAllFiltersButton && showPriceFilter && onPriceSortChange ? (
        <WorkshopPriceSortMenu
          visible={priceMenuOpen}
          value={priceSort}
          onClose={() => setPriceMenuOpen(false)}
          onSelect={onPriceSortChange}
        />
      ) : null}
    </>
  );
}
