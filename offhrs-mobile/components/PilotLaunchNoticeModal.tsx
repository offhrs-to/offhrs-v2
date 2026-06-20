import { Modal, Platform, Pressable, Text, View } from 'react-native';

import { DesignColors } from '@/constants/design-template';

export const PILOT_LAUNCH_ACK_KEY = '@offhrs/hasAcknowledgedPilotLaunch';

type Props = {
  visible: boolean;
  onAcknowledge: () => void;
};

/**
 * One-time pilot launch notice. Unmount entirely when hidden on iOS to avoid a
 * transparent Modal leaving a touch-blocking layer after dismiss (TestFlight).
 * On Android, keep the Modal mounted and drive with `visible` (see root layout).
 */
export default function PilotLaunchNoticeModal({ visible, onAcknowledge }: Props) {
  if (!visible && Platform.OS === 'ios') return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onAcknowledge}
    >
      {visible ? (
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: DesignColors.creamBg,
              borderRadius: 16,
              padding: 24,
              maxWidth: 360,
              width: '100%',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                color: DesignColors.charcoal,
                textAlign: 'center',
                marginBottom: 12,
              }}
            >
              Welcome to our pilot launch
            </Text>
            <Text
              style={{
                fontSize: 15,
                lineHeight: 22,
                color: DesignColors.charcoal,
                marginBottom: 14,
              }}
            >
              offhrs is live in Toronto with a mix of workshop listings:
            </Text>
            <View style={{ gap: 10, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Text style={{ fontSize: 14, lineHeight: 21, color: DesignColors.primary }}>•</Text>
                <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, color: DesignColors.charcoal }}>
                  <Text style={{ fontWeight: '700' }}>Host-posted workshops</Text> — book and pay directly
                  in the app.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Text style={{ fontSize: 14, lineHeight: 21, color: DesignColors.primary }}>•</Text>
                <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, color: DesignColors.charcoal }}>
                  <Text style={{ fontWeight: '700' }}>App-listed workshops</Text> — we link you to the host&apos;s
                  website to book with them directly.
                </Text>
              </View>
            </View>
            <Text
              style={{
                fontSize: 13,
                lineHeight: 19,
                color: DesignColors.mediumGray,
                marginBottom: 20,
              }}
            >
              Thanks for helping us shape the experience — listings and booking options may change as we grow.
            </Text>
            <Pressable
              onPress={onAcknowledge}
              accessibilityRole="button"
              style={{
                paddingVertical: 14,
                borderRadius: 9999,
                backgroundColor: DesignColors.primary,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFF' }}>I understand</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}
