import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

/**
 * Graduation cap (mortarboard) outline icon for the Instructor level.
 * Single-color, clean outline style matching the app’s Instructor badge.
 */
export default function InstructorIcon({
  size = 24,
  color = '#38511B',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Cap top (diamond/square in perspective) */}
      <Path
        d="M12 2L2 7.5l10 5.5 10-5.5L12 2z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Brim (arc) */}
      <Path
        d="M2 7.5v1.5c0 5.52 4.48 10 10 10s10-4.48 10-10V7.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Tassel: stem and end */}
      <Path
        d="M12 13v7"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={20} r={1.25} stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}
