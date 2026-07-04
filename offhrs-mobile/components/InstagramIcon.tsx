import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

/** Minimal outline Instagram glyph (matches common social-link styling). */
export default function InstagramIcon({ size = 22, color = '#888' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityRole="image">
      <Rect x="3" y="3" width="18" height="18" rx="5" stroke={color} strokeWidth={1.75} />
      <Circle cx="12" cy="12" r="4.25" stroke={color} strokeWidth={1.75} />
      <Circle cx="17.2" cy="6.8" r="1.1" fill={color} />
    </Svg>
  );
}
