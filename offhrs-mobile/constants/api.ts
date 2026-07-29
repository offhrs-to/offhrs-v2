/**
 * Web app origin for API calls (e.g. /api/book).
 * Preview EAS builds: set EXPO_PUBLIC_BOOK_API_BASE to your Vercel Preview URL.
 * Production / default: https://offhrs.app
 */
import Constants from 'expo-constants';

export const DEFAULT_BOOK_API_BASE = 'https://offhrs.app';

function normalizeApiBase(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** Native EAS build embeds the correct API origin in `extra` — OTA must not override it. */
function nativeBookApiBase(): string | null {
  const extra = Constants.expoConfig?.extra as { bookApiBase?: string } | undefined;
  const value = extra?.bookApiBase?.trim();
  return value || null;
}

export function resolveBookApiBase(
  envValue: string | undefined = process.env.EXPO_PUBLIC_BOOK_API_BASE
): string {
  const fromNative = nativeBookApiBase();
  if (fromNative) return normalizeApiBase(fromNative);

  const trimmed = (envValue ?? '').trim();
  if (!trimmed) return DEFAULT_BOOK_API_BASE;
  return normalizeApiBase(trimmed);
}

/** Prefer the native build's API origin so OTA bundles cannot point booking at preview/dev servers. */
export const BOOK_API_BASE = resolveBookApiBase();
