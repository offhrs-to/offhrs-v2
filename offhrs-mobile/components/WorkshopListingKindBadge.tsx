import { DesignColors } from '@/constants/design-template';
import {
  getWorkshopListingKindMeta,
  type WorkshopListingKind,
  type WorkshopListingKindFields,
} from '@/lib/workshop-listing-kind';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Platform, View } from 'react-native';

type Props = {
  event?: WorkshopListingKindFields;
  kind?: WorkshopListingKind;
  size?: number;
  iconSize?: number;
};

/**
 * Decorative listing-type chip (vendor-hosted / redirect / app-listed).
 * Non-interactive — for quick view overlay and pilot notice education.
 */
export default function WorkshopListingKindBadge({
  event,
  kind: kindProp,
  size = 44,
  iconSize = 22,
}: Props) {
  const meta = getWorkshopListingKindMeta(kindProp ?? event ?? 'app_listed');

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={meta.label}
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderWidth: 1,
        borderColor: DesignColors.lightGreenBorder,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: Platform.OS === 'android' ? 4 : undefined,
      }}
    >
      <MaterialCommunityIcons name={meta.icon} size={iconSize} color={DesignColors.primary} />
    </View>
  );
}
