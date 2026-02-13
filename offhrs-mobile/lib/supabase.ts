import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, type AppStateStatus, Platform } from 'react-native';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (e.g. in EAS secrets for production builds, or .env for local).'
  );
}

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

/** Secure storage for auth on native (Keychain/Keystore); AsyncStorage on web; fallback to AsyncStorage if SecureStore fails (e.g. value > 2KB on iOS). */
function getAuthStorage(): {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
} {
  if (isNode) return noopStorage;
  if (Platform.OS === 'web') {
    return {
      getItem: async (key: string): Promise<string | null> => {
        const v = await AsyncStorage.getItem(key);
        return typeof v === 'string' && v.length > 0 ? v : null;
      },
      setItem: async (key: string, value: string) => {
        await AsyncStorage.setItem(key, typeof value === 'string' ? value : String(value));
      },
      removeItem: async (key: string) => {
        await AsyncStorage.removeItem(key);
      },
    };
  }

  return {
    getItem: async (key: string): Promise<string | null> => {
      try {
        const v = await SecureStore.getItemAsync(key);
        if (typeof v === 'string' && v.length > 0) return v;
        const fallback = await AsyncStorage.getItem(key);
        if (typeof fallback === 'string' && fallback.length > 0) return fallback;
        return null;
      } catch {
        try {
          const v = await AsyncStorage.getItem(key);
          return typeof v === 'string' && v.length > 0 ? v : null;
        } catch {
          return null;
        }
      }
    },
    setItem: async (key: string, value: string) => {
      const s = typeof value === 'string' ? value : value == null ? '' : String(value);
      try {
        await SecureStore.setItemAsync(key, s);
      } catch {
        await AsyncStorage.setItem(key, s);
      }
    },
    removeItem: async (key: string) => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        /* ignore */
      }
      await AsyncStorage.removeItem(key);
    },
  };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getAuthStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auto-refresh tokens when app returns to foreground (native only, skip in Node/build)
if (!isNode && Platform.OS !== 'web') {
  const handleAppStateChange = (state: AppStateStatus) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  };

  AppState.addEventListener('change', handleAppStateChange);
}
