import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client using the service role key.
 * Use only in API routes or server actions that need to bypass RLS
 * (e.g. aggregating booking counts across all users for admin).
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in env. If missing, returns null.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } })
}
