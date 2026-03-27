import { useCallback, useEffect, useState } from 'react';
import type { ImageContentFit } from 'expo-image';
import { Image } from 'expo-image';
import type { ImageStyle } from 'react-native';

import { getCategoryMasterImageSource } from '@/lib/category-master-images';

type Props = {
  /** Remote workshop/event image; if missing or load fails, Master artwork for `category` is shown. */
  imageUrl: string | null | undefined;
  category: string | null | undefined;
  style: ImageStyle;
  contentFit?: ImageContentFit;
  /** Helps lists recycle bitmaps (optional). */
  recyclingKey?: string;
};

/**
 * Event / vendor listing image with default to category Master artwork when URL is absent or broken.
 */
export default function CategoryFallbackImage({
  imageUrl,
  category,
  style,
  contentFit = 'cover',
  recyclingKey,
}: Props) {
  const masterSource = getCategoryMasterImageSource(category);
  const [loadFailed, setLoadFailed] = useState(false);

  const trimmed = typeof imageUrl === 'string' ? imageUrl.trim() : '';
  const useRemote = trimmed.length > 0 && !loadFailed;

  useEffect(() => {
    setLoadFailed(false);
  }, [imageUrl]);

  const onError = useCallback(() => {
    setLoadFailed(true);
  }, []);

  return (
    <Image
      source={useRemote ? { uri: trimmed } : masterSource}
      style={style}
      contentFit={contentFit}
      onError={onError}
      recyclingKey={recyclingKey ?? (useRemote ? trimmed : `master-${category ?? 'other'}`)}
    />
  );
}
