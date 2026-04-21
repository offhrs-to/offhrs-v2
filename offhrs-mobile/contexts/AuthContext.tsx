import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Tracks whether a user is currently set so the onAuthStateChange handler can decide
  // whether a null-session event on Android is a real sign-out or a token-refresh artifact.
  const hasUserRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      hasUserRef.current = !!session?.user;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Android: during an OAuth sign-in, startAutoRefresh() can race with the OAuth
      // code exchange, causing Supabase to emit a null-session event (failed auto-refresh)
      // that is NOT a real sign-out. Ignore these so the user object is not cleared and
      // the onboarding check is not re-triggered.
      if (Platform.OS === 'android' && !session?.user && event !== 'SIGNED_OUT') {
        if (hasUserRef.current) {
          setLoading(false);
          return;
        }
      }
      hasUserRef.current = !!session?.user;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
