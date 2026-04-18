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
 * @see https://docs.expo.dev/versions/latest/config/app/#config
 * @see https://docs.expo.dev/build-reference/variables/
 */
const fs = require('fs');
const path = require('path');

const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));

const googleMapsApiKey = (process.env.GOOGLE_MAPS_API_KEY || '').trim();

module.exports = {
  expo: {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
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
