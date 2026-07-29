import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { AppFonts } from '@/lib/nunito-sans';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color, fontFamily: AppFonts.regular },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: AppFonts.regular,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: AppFonts.semiBold,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontFamily: AppFonts.bold,
    fontWeight: '700',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontFamily: AppFonts.bold,
    fontWeight: '700',
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    fontFamily: AppFonts.regular,
    color: '#0a7ea4',
  },
});
