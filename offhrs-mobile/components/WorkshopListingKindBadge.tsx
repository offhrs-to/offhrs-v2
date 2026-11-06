import { DesignColors } from '@/constants/design-template';
import {
  getWorkshopListingKindMeta,
  type WorkshopListingKind,
  type WorkshopListingKindFields,
} from '@/lib/workshop-listing-kind';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Alert, Platform, Pressable } from 'react-native';

type Props = {
  event?: WorkshopListingKindFields;
  kind?: WorkshopListingKind;
  size?: number;
  iconSize?: number;
};

/**
 * Listing-type chip (vendor-hosted / redirect / app-listed).
 * Tap shows a short explanation of what that listing kind means.
 */
export default function WorkshopListingKindBadge({
  event,
  kind: kindProp,
  size = 44,
  iconSize = 22,
}: Props) {
  const meta = getWorkshopListingKindMeta(kindProp ?? event ?? 'app_listed');

  return (
    <Pressable
      onPress={() => Alert.alert(meta.label, meta.description)}
      accessibilityRole="button"
      accessibilityLabel={`${meta.label}. ${meta.description}`}
      accessibilityHint="Shows what this listing type means"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderWidth: 1,
        borderColor: DesignColors.lightGreenBorder,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
        elevation: Platform.OS === 'android' ? 4 : undefined,
      })}
    >
      <MaterialCommunityIcons name={meta.icon} size={iconSize} color={DesignColors.primary} />
    </Pressable>
  );
}
