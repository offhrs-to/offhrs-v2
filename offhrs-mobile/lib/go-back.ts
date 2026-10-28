import type { Href, Router } from 'expo-router';

/** Pop one screen. If this screen was opened directly, return to the tabs. */
export function goBack(router: Router, fallback: Href = '/(tabs)') {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
