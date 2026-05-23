/**
 * Standard design template (from Home page).
 * Import these tokens and specs to keep new screens consistent.
 */

import { Dimensions, Platform } from 'react-native';

/** True on iPad only. Use for layout that must not affect iPhone or Android. */
export function isIOSPad(): boolean {
  if (Platform.OS !== 'ios') return false;
  return (Platform as { isPad: boolean }).isPad;
}

// ─── Colors ─────────────────────────────────────────────────────────────
export const DesignColors = {
  /** Sage green – category pills, search arrow, inactive accents */
  sageGreen: '#5D755D',
  /** Light green border – cards, inputs, pills */
  lightGreenBorder: '#A8C4A0',
  /** Hero / reflection card background */
  heroBg: '#E8F0E5',
  /** Page and card background (cream) */
  creamBg: '#FDFCF8',
  /** Primary text (headings, body) */
  charcoal: '#2C2C2C',
  /** Muted / secondary text */
  mediumGray: '#6B6B6B',
  /** Primary CTA and selected tab (e.g. Browse Workshops button) */
  primary: '#38511B',
  /** Placeholder / input background */
  inputBg: '#F5F5F5',
  /** Profile/avatar placeholder */
  placeholderGray: '#E0E0E0',
} as const;

// ─── Spacing ────────────────────────────────────────────────────────────
export const DesignSpacing = {
  horizontalPadding: 24,
  /** Top inset for logo strip / primary headers (tabs + workshop chrome). */
  contentPaddingTop: 56,
  contentPaddingBottom: 32,
  headerMarginBottom: 12,
  /** Bottom padding under logo strip on fixed tab headers (Home, Workshops, Contact). */
  logoHeaderPaddingBottom: 6,
  logoMarginLeft: -40,
  heroCardMarginTop: 6,
  heroCardPaddingBottom: 20,
  heroCardBorderRadius: 18,
  heroTitleMarginTop: 24,
  heroTitleMarginBottom: 12,
  heroSubtitleMarginBottom: 36,
  heroSubtitleFontSize: 27,
  searchInputMarginHorizontal: 20,
  searchInputPaddingH: 12,
  searchInputPaddingV: 9,
  searchInputFontSize: 12,
  sectionTitleMarginTop: 24,
  sectionTitleMarginBottom: 24,
  sectionTitleFontSize: 15,
  categoryGap: 12,
  categoryButtonHeight: 68,
  categoryButtonPaddingH: 20,
  categoryButtonPaddingV: 12,
  ctaWrapperMarginTop: 12,
  ctaPaddingVertical: 12,
  ctaPaddingHorizontal: 24,
} as const;

// ─── Sizes ──────────────────────────────────────────────────────────────
export const DesignSizes = {
  logoHeight: 48,
  logoWidth: 160,
  profilePlaceholderSize: 52,
  profilePlaceholderRadius: 26,
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────
/** Button width so 2 category pills fit per row (with horizontal padding and gap). */
export function getCategoryButtonWidth(): number {
  const { horizontalPadding, categoryGap } = DesignSpacing;
  return (Dimensions.get('window').width - horizontalPadding * 2 - categoryGap) / 2;
}

