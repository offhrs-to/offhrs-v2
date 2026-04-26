import { DesignSpacing } from '@/constants/design-template';
import { ScrollView, Text, View } from 'react-native';

/**
 * Security hardening:
 * Mobile admin is intentionally disabled in shipped app builds.
 * Admin actions must go through server-side admin routes with verified auth.
 */
export default function AdminScreen() {
  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: DesignSpacing.contentPaddingTop + 4,
        paddingBottom: 40,
      }}
    >
      <View className="rounded-lg border border-gray-200 bg-white p-4">
        <Text className="mb-2 text-xl font-bold text-gray-900">Admin Disabled</Text>
        <Text className="text-sm leading-6 text-gray-700">
          For security, mobile in-app admin controls are disabled in production.
          Use the secured web admin flow instead.
        </Text>
      </View>
    </ScrollView>
  );
}
