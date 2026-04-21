import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, type AppStateStatus, Platform } from 'react-native';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  'https://gzoymzlegnfhdfmkblpd.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6b3ltemxlZ25maGRmbWtibHBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDQ3ODEsImV4cCI6MjA4NDY4MDc4MX0.DCDfJP-hoi4IlWkrD3jc4Pxu1JV3n-PHYg_IRS7xE00';

// During Node/build, window is undefined; AsyncStorage would throw. Use no-op storage.
const isNode =
  typeof process !== 'undefined' &&
  process.versions != null &&
  typeof process.versions.node === 'string';

const noopStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isNode ? noopStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auto-refresh tokens when app returns to foreground (native only, skip in Node/build)
if (!isNode && Platform.OS !== 'web') {
  // Android: debounce startAutoRefresh() by 500ms so the OAuth code exchange has time to
  // complete and the session is fully stored before the auto-refresh timer starts. Without
  // this, startAutoRefresh() races with the OAuth callback when Chrome Custom Tab closes,
  // causing a SIGNED_OUT event that clears the user and triggers spurious onboarding rechecks.
  let androidAutoRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  const handleAppStateChange = (state: AppStateStatus) => {
    if (state === 'active') {
      if (Platform.OS === 'android') {
        if (androidAutoRefreshTimer) clearTimeout(androidAutoRefreshTimer);
        androidAutoRefreshTimer = setTimeout(() => {
          androidAutoRefreshTimer = null;
          supabase.auth.startAutoRefresh();
        }, 500);
      } else {
        supabase.auth.startAutoRefresh();
      }
    } else {
      if (androidAutoRefreshTimer) {
        clearTimeout(androidAutoRefreshTimer);
        androidAutoRefreshTimer = null;
      }
      supabase.auth.stopAutoRefresh();
    }
  };

  AppState.addEventListener('change', handleAppStateChange);
}
