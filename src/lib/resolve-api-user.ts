import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  return token || null
}

/**
 * Resolve the authenticated Supabase user for mobile/API requests.
 * Cookie session (web) first, then Bearer JWT validated via auth.getUser(jwt).
 */
export async function resolveApiUser(request: NextRequest): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser()
  if (cookieUser) return cookieUser

  const bearerToken = extractBearerToken(request)
  if (!bearerToken) return null

  const bearerClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const {
    data: { user: bearerUser },
    error,
  } = await bearerClient.auth.getUser(bearerToken)

  if (error) {
    console.warn('resolveApiUser: bearer validation failed', error.message)
    return null
  }

  return bearerUser ?? null
}
