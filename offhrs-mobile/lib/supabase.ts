import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
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

/** If value is session-like JSON with missing/invalid access_token, return null to avoid decodeJWT(null) crash in auth-js. Otherwise return value. */
function validSessionOrNull(value: string | null | undefined): string | null {
  if (value == null || typeof value !== 'string' || value.length === 0) return null;
  try {
    const trimmed = value.trim();
    if (trimmed.charAt(0) !== '{') return value;
    const obj = JSON.parse(trimmed) as unknown;
    if (obj && typeof obj === 'object' && 'access_token' in obj) {
      const tok = (obj as { access_token?: unknown }).access_token;
      if (typeof tok !== 'string' || tok.length === 0) return null;
    }
    return value;
  } catch {
    return null;
  }
}

/** In-memory store for auth on native (no native storage calls; avoids TestFlight crash). Session does not persist across app restarts. */
const memoryStore = new Map<string, string>();

const inMemoryStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return memoryStore.get(key) ?? null;
  },
  setItem: async (key: string, value: string) => {
    const s = value != null && typeof value === 'string' ? value : String(value ?? '');
    if (s.length === 0) {
      memoryStore.delete(key);
      return;
    }
    memoryStore.set(key, s);
  },
  removeItem: async (key: string) => {
    memoryStore.delete(key);
  },
};

/** Auth storage: in-memory on native (no persistence), AsyncStorage on web, noop for Node. */
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
        if (typeof v !== 'string' || v.length === 0) return null;
        return validSessionOrNull(v);
      },
      setItem: async (key: string, value: string) => {
        await AsyncStorage.setItem(key, typeof value === 'string' ? value : String(value));
      },
      removeItem: async (key: string) => {
        await AsyncStorage.removeItem(key);
      },
    };
  }
  return inMemoryStorage;
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
