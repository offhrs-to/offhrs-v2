import * as WebBrowser from 'expo-web-browser';

/**
 * After OAuth returns to the app, dismiss the native auth session so the UI
 * receives touches again (fixes stuck / non-interactive UI on iOS and Android).
 */
export function completeOAuthBrowserSession(): void {
  try {
    WebBrowser.dismissAuthSession();
  } catch {
    /* Session may already be closed */
  }
  try {
    WebBrowser.dismissBrowser();
  } catch {
    /* Browser may already be closed */
  }
}
