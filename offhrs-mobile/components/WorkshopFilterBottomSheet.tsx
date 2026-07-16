import { DesignColors } from '@/constants/design-template';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional footer (e.g. Apply / Done). */
  footer?: ReactNode;
  /** Max fraction of screen height for the sheet body (default 0.55). */
  maxHeightRatio?: number;
};

/**
 * ClassPass-style bottom sheet: slides up, dismiss by tapping the dimmed area.
 */
export default function WorkshopFilterBottomSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxHeightRatio = 0.55,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetMaxHeight = Math.round(windowHeight * maxHeightRatio);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
          onPress={onClose}
          accessibilityLabel="Dismiss"
        />
        <View
          style={{
            backgroundColor: '#FFF',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: sheetMaxHeight,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#D0D0D0',
              }}
            />
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal }}>{title}</Text>
            {subtitle ? (
              <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginTop: 6, lineHeight: 18 }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            bounces={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 8 }}
          >
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

type RadioRowProps = {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  /** When true, draw a bottom border under this row. Default false. */
  showDivider?: boolean;
  /** Checkbox indicator for multi-select lists (e.g. categories). */
  checkbox?: boolean;
};

export function WorkshopFilterRadioRow({
  label,
  description,
  selected,
  onPress,
  showDivider = false,
  checkbox = false,
}: RadioRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderBottomWidth: showDivider ? 1 : 0,
        borderBottomColor: DesignColors.lightGreenBorder,
      }}
      accessibilityRole={checkbox ? 'checkbox' : 'radio'}
      accessibilityState={{ selected, checked: checkbox ? selected : undefined }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: selected ? '600' : '500',
            color: DesignColors.charcoal,
          }}
        >
          {label}
        </Text>
        {description ? (
          <Text
            style={{
              fontSize: 12,
              color: DesignColors.mediumGray,
              marginTop: 2,
              lineHeight: 15,
            }}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {checkbox ? (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: selected ? DesignColors.primary : '#C8C8C8',
            backgroundColor: selected ? DesignColors.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? (
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700', lineHeight: 14 }}>✓</Text>
          ) : null}
        </View>
      ) : (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: selected ? DesignColors.primary : '#C8C8C8',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? (
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: DesignColors.primary,
              }}
            />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}
