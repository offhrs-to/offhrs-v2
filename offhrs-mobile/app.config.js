/**
 * Extends app.json so Android gets Google Maps API key (required for react-native-maps).
 * Set GOOGLE_MAPS_API_KEY in EAS Secrets (production/preview) or .env for local prebuild.
 * @see https://docs.expo.dev/versions/latest/config/app/#config
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
