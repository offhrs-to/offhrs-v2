/**
 * Web app origin for API calls (e.g. /api/book).
 * Preview EAS builds: set EXPO_PUBLIC_BOOK_API_BASE to your Vercel Preview URL.
 * Production / default: https://offhrs.app
 */
export const DEFAULT_BOOK_API_BASE = 'https://offhrs.app';

function normalizeApiBase(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function resolveBookApiBase(
  envValue: string | undefined = process.env.EXPO_PUBLIC_BOOK_API_BASE
): string {
  const trimmed = (envValue ?? '').trim();
  if (!trimmed) return DEFAULT_BOOK_API_BASE;
  return normalizeApiBase(trimmed);
}

/** Resolved at build time from EXPO_PUBLIC_BOOK_API_BASE (see eas.json preview profile). */
export const BOOK_API_BASE = resolveBookApiBase();
