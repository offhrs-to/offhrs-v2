import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Android embeds Google Maps in react-native-maps; without a valid API key in the native
 * manifest the process can crash when MapView mounts. Keys are set at build time via
 * app.config.js → android.config.googleMaps.apiKey (e.g. GOOGLE_MAPS_API_KEY on EAS).
 *
 * Important: EAS Update replaces `expoConfig.extra` from the publish environment. If the
 * OTA machine lacks GOOGLE_MAPS_API_KEY, `hasAndroidMapsKey` becomes false even though the
 * installed binary still has the key in AndroidManifest — so we must not block MapView
 * solely on that OTA flag for release clients.
 */
export function hasAndroidMapsKeyInBuild(): boolean {
  const fromExtra = Constants.expoConfig?.extra?.hasAndroidMapsKey === true;
  const fromConfig = Boolean(
    String(Constants.expoConfig?.android?.config?.googleMaps?.apiKey ?? '').trim()
  );
  if (fromExtra || fromConfig) return true;
  // Release / store / preview binaries: assume the last eas build embedded the key.
  // Only gate strictly in __DEV__ (Expo Go / local) where a missing key can crash.
  return !__DEV__;
}

/** Safe to mount react-native-maps MapView (iOS uses Apple Maps by default; Android needs Google key). */
export function canMountNativeMapView(): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') return hasAndroidMapsKeyInBuild();
  return true;
}

