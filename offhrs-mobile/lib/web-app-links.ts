import * as Linking from 'expo-linking';

import { BOOK_API_BASE } from '@/constants/api';

export function getWebAppOrigin(): string {
  const raw = process.env.EXPO_PUBLIC_APP_URL;
  const trimmed = typeof raw === 'string' ? raw.replace(/\/$/, '') : '';
  return trimmed || BOOK_API_BASE;
}

/** Legal / policy pages on the web app (same paths as Next.js routes). */
export type WebAppPolicyPath = '/privacy' | '/terms' | '/disclaimer';

/**
 * Opens https://offhrs.app/... (or EXPO_PUBLIC_APP_URL) in the system browser.
 * Falls back to BOOK_API_BASE if the env URL fails to open.
 */
export async function openWebAppPath(path: WebAppPolicyPath): Promise<void> {
  const base = getWebAppOrigin();
  const url = `${base}${path}`;
  try {
    await Linking.openURL(url);
  } catch {
    if (base !== BOOK_API_BASE) {
      try {
        await Linking.openURL(`${BOOK_API_BASE}${path}`);
      } catch {
        /* ignore */
      }
    }
  }
}

