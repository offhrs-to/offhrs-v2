import {
  NunitoSans_200ExtraLight,
  NunitoSans_300Light,
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  NunitoSans_800ExtraBold,
  NunitoSans_900Black,
} from '@expo-google-fonts/nunito-sans';

/** Loaded via `useFonts(nunitoSansFontMap)` in the root layout. */
export const nunitoSansFontMap = {
  NunitoSans_200ExtraLight,
  NunitoSans_300Light,
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  NunitoSans_800ExtraBold,
  NunitoSans_900Black,
};

/** `fontFamily` values registered by `useFonts` / expo-font. */
export const AppFonts = {
  extraLight: 'NunitoSans_200ExtraLight',
  light: 'NunitoSans_300Light',
  regular: 'NunitoSans_400Regular',
  medium: 'NunitoSans_500Medium',
  semiBold: 'NunitoSans_600SemiBold',
  bold: 'NunitoSans_700Bold',
  extraBold: 'NunitoSans_800ExtraBold',
  black: 'NunitoSans_900Black',
} as const;

/**
 * @deprecated No-op. RN 0.81 / Fabric no longer supports Text.render / defaultProps.
 * Nunito is applied via babel rewrite → `@/components/AppText`.
 */
export function applyNunitoSansTextDefaults(): void {
  // intentionally empty
}
