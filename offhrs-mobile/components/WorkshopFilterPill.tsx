import { DesignColors } from '@/constants/design-template';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  label: string;
  active?: boolean;
  onPress: () => void;
  /** Optional layout overrides (e.g. `{ flex: 1 }` to fill a row). */
  style?: StyleProp<ViewStyle>;
};

/** ClassPass-style filter chip with trailing chevron. */
export default function WorkshopFilterPill({ label, active = false, onPress, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 9999,
          backgroundColor: active ? DesignColors.heroBg : DesignColors.inputBg,
          borderWidth: 1,
          borderColor: active ? DesignColors.primary : DesignColors.lightGreenBorder,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: active ? DesignColors.primary : DesignColors.charcoal,
          flexShrink: 1,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <MaterialCommunityIcons
        name="chevron-down"
        size={16}
        color={active ? DesignColors.primary : DesignColors.mediumGray}
      />
    </Pressable>
  );
}

export function WorkshopFilterPillRow({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
        marginBottom: 12,
      }}
    >
      {children}
    </View>
  );
}
