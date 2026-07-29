import { Platform } from 'react-native';

import { DesignSpacing, isIOSPad } from '@/constants/design-template';

/**
 * Home horizontal carousel card layout — square media, two full cards visible
 * in the padded content width (Airbnb Experiences–style), with a slight peek of the next.
 */
export function getHomeCarouselCardMetrics(windowWidth: number) {
  const isAndroid = Platform.OS === 'android';
  const isIPad = isIOSPad();
  const CARD_GAP = 10;
  /** How much of the next card shows past the right edge. */
  const NEXT_PEEK = 18;
  const contentWidth = windowWidth - DesignSpacing.horizontalPadding * 2;
  const baseWidth = Math.floor((contentWidth - CARD_GAP - NEXT_PEEK) / 2);
  /** ~5% larger than the prior 0.9 scale; still leaves a peek of the next card. */
  const CARD_WIDTH = Math.max(132, Math.floor(baseWidth * 0.945));
  /** Square image plane — keep identical across Toronto / Near you / Featured. */
  const CARD_IMAGE_HEIGHT = CARD_WIDTH;

  const titleLineHeight = isIPad ? 20 : 17;
  const titleBlockHeight = titleLineHeight;
  const titleToMetaGap = 3;
  const metaLineHeight = 15;
  const priceLineHeight = 17;
  const cardFooterPaddingTop = 6;
  const cardFooterPaddingBottom = isAndroid ? 12 : 8;
  const CARD_FOOTER_HEIGHT =
    cardFooterPaddingTop +
    titleBlockHeight +
    titleToMetaGap +
    metaLineHeight +
    priceLineHeight +
    cardFooterPaddingBottom;

  return {
    isAndroid,
    isIPad,
    CARD_WIDTH,
    CARD_GAP,
    PAGE: CARD_WIDTH + CARD_GAP,
    CARD_IMAGE_HEIGHT,
    titleLineHeight,
    titleBlockHeight,
    titleToMetaGap,
    metaLineHeight,
    priceLineHeight,
    cardFooterPaddingTop,
    cardFooterPaddingBottom,
    CARD_FOOTER_HEIGHT,
    loadingPlaceholderHeight: CARD_IMAGE_HEIGHT + CARD_FOOTER_HEIGHT + 14,
  };
}
