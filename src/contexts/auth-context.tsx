'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/browser'

type AuthContextType = {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const deferredGetSession = () => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        setUser(user ?? null)
        setLoading(false)
      })
    }

    const useIdle = typeof requestIdleCallback !== 'undefined'
    const id = useIdle
      ? requestIdleCallback(deferredGetSession, { timeout: 200 })
      : setTimeout(deferredGetSession, 0)

    return () => {
      subscription.unsubscribe()
      if (useIdle && typeof cancelIdleCallback !== 'undefined') cancelIdleCallback(id)
      else clearTimeout(id)
    }
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
