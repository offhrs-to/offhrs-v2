import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('supabaseUrl is required.')
    }
    client = createClient(supabaseUrl, supabaseAnonKey)
  }
  return client
}

/** Lazy client so Next.js prerender does not throw when env vars are absent at build time. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const active = getSupabaseClient()
    const value = Reflect.get(active, prop, receiver)
    return typeof value === 'function' ? value.bind(active) : value
  },
})

