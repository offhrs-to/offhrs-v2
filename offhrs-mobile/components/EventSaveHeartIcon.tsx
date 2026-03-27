import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { DesignColors } from '@/constants/design-template';

type Props = {
  saved: boolean;
  size?: number;
};

/** Filled heart when saved, outline when not — for workshop save / quick-view controls. */
export function EventSaveHeartIcon({ saved, size = 24 }: Props) {
  return (
    <MaterialCommunityIcons
      name={saved ? 'heart' : 'heart-outline'}
      size={size}
      color={saved ? DesignColors.primary : DesignColors.charcoal}
    />
  );
}
