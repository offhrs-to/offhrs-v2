import { DesignColors, DesignSpacing } from '@/constants/design-template';
import { openWebAppPath } from '@/lib/web-app-links';
import { Pressable, Text, View } from 'react-native';

/** Guest path to the partners site. Opens in the system browser on iOS and Android. */
export function StudioJoinCard() {
  return (
    <View
      style={{
        marginTop: 16,
        backgroundColor: '#FFF',
        borderRadius: DesignSpacing.heroCardBorderRadius,
        borderWidth: 1,
        borderColor: DesignColors.lightGreenBorder,
        padding: 16,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '700', color: DesignColors.charcoal }}>
        Are you a studio?
      </Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: 14,
          lineHeight: 20,
          color: DesignColors.mediumGray,
        }}
      >
        List workshops on offhrs.
      </Text>
      <Pressable
        onPress={() => void openWebAppPath('/partners/signup')}
        accessibilityRole="link"
        accessibilityLabel="Join offhrs"
        style={{
          marginTop: 14,
          paddingVertical: 14,
          borderRadius: 9999,
          backgroundColor: DesignColors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFF' }}>Join offhrs</Text>
      </Pressable>
      <Pressable
        onPress={() => void openWebAppPath('/partners/login')}
        accessibilityRole="link"
        accessibilityLabel="Already a partner? Sign in"
        style={{ marginTop: 12, alignItems: 'center', paddingVertical: 4 }}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.primary }}>
          Already a partner? Sign in
        </Text>
      </Pressable>
    </View>
  );
}
