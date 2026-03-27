import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type Props = {
  saved: boolean;
  size?: number;
};

/** Strong red for contrast on light backgrounds (saved + outline). */
const HEART_RED = '#DC2626';

/** Filled heart when saved, outline when not — for workshop save / quick-view controls. */
export function EventSaveHeartIcon({ saved, size = 24 }: Props) {
  return (
    <MaterialCommunityIcons
      name={saved ? 'heart' : 'heart-outline'}
      size={size}
      color={HEART_RED}
    />
  );
}
