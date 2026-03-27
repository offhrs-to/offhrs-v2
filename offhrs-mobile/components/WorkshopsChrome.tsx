import { DesignColors, DesignSizes, DesignSpacing } from '@/constants/design-template';
import { Image } from 'expo-image';
import { Pressable, Text, TextInput, View } from 'react-native';

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
}: WorkshopsChromeProps) {
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
        </View>
      </View>
    </>
  );
}
