/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

import { AppFonts } from '@/lib/nunito-sans';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: AppFonts.regular,
    serif: AppFonts.regular,
    rounded: AppFonts.regular,
    mono: 'ui-monospace',
  },
  default: {
    sans: AppFonts.regular,
    serif: AppFonts.regular,
    rounded: AppFonts.regular,
    mono: 'monospace',
  },
  web: {
    sans: `'Nunito Sans', ${AppFonts.regular}, system-ui, sans-serif`,
    serif: `'Nunito Sans', ${AppFonts.regular}, Georgia, serif`,
    rounded: `'Nunito Sans', ${AppFonts.regular}, system-ui, sans-serif`,
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
