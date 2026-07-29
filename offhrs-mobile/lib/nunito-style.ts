import { Platform, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { AppFonts } from '@/lib/nunito-sans';

const WEIGHT_TO_FAMILY: Record<string, string> = {
  '100': AppFonts.extraLight,
  '200': AppFonts.extraLight,
  '300': AppFonts.light,
  '400': AppFonts.regular,
  '500': AppFonts.medium,
  '600': AppFonts.semiBold,
  '700': AppFonts.bold,
  '800': AppFonts.extraBold,
  '900': AppFonts.black,
  normal: AppFonts.regular,
  bold: AppFonts.bold,
};

/**
 * Map `fontWeight` → the matching Nunito Sans face. Used by the Metro Text shim
 * so every app Text/TextInput picks up Nunito without per-screen fontFamily.
 */
export function resolveNunitoStyle(style: StyleProp<TextStyle> | undefined): StyleProp<TextStyle> {
  const flat = StyleSheet.flatten(style) ?? {};

  // Keep an explicit family (Nunito weight face, monospace, etc.).
  if (typeof flat.fontFamily === 'string' && flat.fontFamily.length > 0) {
    if (flat.fontFamily.startsWith('NunitoSans_') && Platform.OS === 'android') {
      return [style, { fontWeight: undefined as unknown as TextStyle['fontWeight'] }];
    }
    return style;
  }

  const weightKey = flat.fontWeight != null ? String(flat.fontWeight) : '400';
  const fontFamily = WEIGHT_TO_FAMILY[weightKey] ?? AppFonts.regular;

  return [
    style,
    {
      fontFamily,
      ...(Platform.OS === 'android'
        ? { fontWeight: undefined as unknown as TextStyle['fontWeight'] }
        : null),
    },
  ];
}
