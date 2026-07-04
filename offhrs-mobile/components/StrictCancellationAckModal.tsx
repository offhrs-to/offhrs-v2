import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DesignColors } from '@/constants/design-template';
import { openWebAppPath } from '@/lib/web-app-links';
import type { ConsumerRefundPolicyDisplay } from '@/lib/vendor-refund-policy';

export type StrictCancellationAckModalProps = {
  visible: boolean;
  policy: ConsumerRefundPolicyDisplay | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function StrictCancellationAckModal({
  visible,
  policy,
  onCancel,
  onConfirm,
}: StrictCancellationAckModalProps) {
  const insets = useSafeAreaInsets();
  const [checked, setChecked] = useState(false);

  const handleDismiss = () => {
    setChecked(false);
    onCancel();
  };

  const handleConfirm = () => {
    if (!checked) return;
    setChecked(false);
    onConfirm();
  };

  if (!policy?.strictNoRefund) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
      onShow={() => setChecked(false)}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.45)',
          paddingTop: Platform.OS === 'android' ? insets.top : 0,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={handleDismiss} accessibilityLabel="Dismiss" />
        <View
          style={{
            maxHeight: '88%',
            backgroundColor: '#FFF',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal }}>
              Cancellation policy
            </Text>
          </View>

          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {policy.summary ? (
              <Text style={{ fontSize: 14, color: DesignColors.charcoal, lineHeight: 21, marginBottom: 12 }}>
                {policy.summary}
              </Text>
            ) : null}

            {policy.detailBullets.map((bullet) => (
              <View
                key={bullet}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}
              >
                <Text style={{ fontSize: 14, color: DesignColors.charcoal, lineHeight: 21 }}>•</Text>
                <Text style={{ flex: 1, fontSize: 14, color: DesignColors.charcoal, lineHeight: 21 }}>
                  {bullet}
                </Text>
              </View>
            ))}

            {policy.platformFooter ? (
              <Text style={{ marginTop: 8, fontSize: 12, color: DesignColors.mediumGray, lineHeight: 17 }}>
                {policy.platformFooter}
              </Text>
            ) : null}

            <Pressable onPress={() => void openWebAppPath('/terms')} style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 12, color: DesignColors.primary, fontWeight: '600' }}>
                View offhrs terms
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setChecked((v) => !v)}
              style={{
                marginTop: 16,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: checked ? DesignColors.primary : '#C4C4C4',
                  backgroundColor: checked ? DesignColors.primary : '#FFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                }}
              >
                {checked ? (
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700', lineHeight: 16 }}>✓</Text>
                ) : null}
              </View>
              <Text style={{ flex: 1, fontSize: 14, color: DesignColors.charcoal, lineHeight: 20 }}>
                {policy.ackLabel ?? 'I understand this booking is non-refundable'}
              </Text>
            </Pressable>
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              paddingHorizontal: 20,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: '#E8E4DE',
            }}
          >
            <Pressable
              onPress={handleDismiss}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: DesignColors.primary,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.primary }}>Go back</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={!checked}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: checked ? DesignColors.primary : '#B8C4B8',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFF' }}>Continue to pay</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
