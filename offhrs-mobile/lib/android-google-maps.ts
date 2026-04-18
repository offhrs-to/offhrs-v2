import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Android embeds Google Maps in react-native-maps; without a valid API key in the native
 * manifest the process can crash when MapView mounts. Keys are set at build time via
 * app.config.js → android.config.googleMaps.apiKey (e.g. GOOGLE_MAPS_API_KEY on EAS).
 */
export function hasAndroidMapsKeyInBuild(): boolean {
  return Constants.expoConfig?.extra?.hasAndroidMapsKey === true;
}

/** Safe to mount react-native-maps MapView (iOS uses Apple Maps by default; Android needs Google key). */
export function canMountNativeMapView(): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') return hasAndroidMapsKeyInBuild();
  return true;
}
