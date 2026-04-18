/**
 * Extends app.json so Android gets Google Maps API key (required for react-native-maps).
 *
 * EAS Build (production / preview / development):
 *   1. Create a Google Cloud "Maps SDK for Android" API key restricted to package com.offhrs.app.
 *   2. In Expo: Project → Secrets, add secret name GOOGLE_MAPS_API_KEY (same name as env var).
 *      EAS injects project secrets into the build environment; app.config.js reads process.env here.
 *   3. Run a new Android build. OTA updates cannot add the native manifest key — you must rebuild.
 *
 * Local prebuild / eas build --local: export GOOGLE_MAPS_API_KEY or add to .env loaded before prebuild.
 *
 * Expo Go: usually still shows map placeholders; use a dev client or release build to test real maps.
 *
 * Splash (Android): smaller expo-splash-screen imageWidth when EAS_BUILD_PLATFORM=android or
 * EXPO_ANDROID_SPLASH=1 (npm script `android` sets this) so the wordmark is not clipped on narrow devices.
 * New Android native build required after changing splash config.
 *
 * @see https://docs.expo.dev/versions/latest/config/app/#config
 * @see https://docs.expo.dev/build-reference/variables/
 */
const fs = require('fs');
const path = require('path');

const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));

const googleMapsApiKey = (process.env.GOOGLE_MAPS_API_KEY || '').trim();

/** EAS sets this during cloud builds; EXPO_ANDROID_SPLASH=1 for local `expo run:android` (see package.json). */
const isAndroidSplashTarget =
  process.env.EAS_BUILD_PLATFORM === 'android' || process.env.EXPO_ANDROID_SPLASH === '1';

/** Narrower logo on Android splash to avoid horizontal clipping (iOS uses app.json plugin defaults). */
const ANDROID_SPLASH_IMAGE_WIDTH = 190;

function withAndroidSplashPlugins(plugins) {
  if (!Array.isArray(plugins)) return plugins;
  return plugins.map((p) => {
    if (Array.isArray(p) && p[0] === 'expo-splash-screen' && isAndroidSplashTarget) {
      const opts = { ...(p[1] || {}) };
      opts.imageWidth = ANDROID_SPLASH_IMAGE_WIDTH;
      return ['expo-splash-screen', opts];
    }
    return p;
  });
}

module.exports = {
  expo: {
    ...appJson.expo,
    plugins: withAndroidSplashPlugins(appJson.expo.plugins || []),
    android: {
      ...appJson.expo.android,
      splash: {
        image: './assets/images/logo.png',
        backgroundColor: '#ffffff',
        resizeMode: 'contain',
      },
      config: {
        ...(appJson.expo.android && appJson.expo.android.config),
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    extra: {
      ...(appJson.expo.extra || {}),
      hasAndroidMapsKey: googleMapsApiKey.length > 0,
    },
  },
};
