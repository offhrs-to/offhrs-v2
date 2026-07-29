import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  return token || null
}

function supabaseProjectUrl(): string | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  return url ? url.replace(/\/+$/, '') : null
}

function supabaseApiKey(): string | null {
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
  return key || null
}

/** Direct Auth REST call — reliable with publishable (`sb_publishable_`) and legacy anon keys. */
async function fetchUserViaAuthApi(jwt: string): Promise<User | null> {
  const baseUrl = supabaseProjectUrl()
  const apikey = supabaseApiKey()
  if (!baseUrl || !apikey) return null

  try {
    const res = await fetch(`${baseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey,
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('resolveApiUser: auth/v1/user failed', res.status, text.slice(0, 200))
      return null
    }
    const user = (await res.json()) as User
    return user?.id ? user : null
  } catch (err) {
    console.warn('resolveApiUser: auth/v1/user error', err)
    return null
  }
}

function serverProjectRef(): string | null {
  const url = supabaseProjectUrl()
  if (!url) return null
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/)
  return match?.[1] ?? null
}

function jwtProjectRef(jwt: string): string | null {
  try {
    const segment = jwt.split('.')[1]
    if (!segment) return null
    const payload = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as {
      iss?: string
    }
    const iss = payload.iss ?? ''
    const match = iss.match(/https:\/\/([^.]+)\.supabase\.co/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

/** Same pattern as /api/book and /api/book/confirm — proven for mobile Bearer auth. */
async function fetchUserViaGlobalAuthHeader(jwt: string, apiKey: string): Promise<User | null> {
  const baseUrl = supabaseProjectUrl()
  if (!baseUrl) return null

  const client = createSupabaseClient(baseUrl, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })

  const { data: { user }, error } = await client.auth.getUser()
  if (error) {
    console.warn('resolveApiUser: global header getUser failed', error.message)
    return null
  }
  return user ?? null
}

async function fetchUserViaSupabaseClient(jwt: string, apiKey: string): Promise<User | null> {
  const baseUrl = supabaseProjectUrl()
  if (!baseUrl) return null

  const client = createSupabaseClient(baseUrl, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user }, error } = await client.auth.getUser(jwt)
  if (error) {
    console.warn('resolveApiUser: auth.getUser(jwt) failed', error.message)
    return null
  }
  return user ?? null
}

/**
 * Resolve the authenticated Supabase user for web (cookies) and mobile (Bearer JWT).
 */
export async function resolveApiUser(request: NextRequest): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser()
  if (cookieUser) return cookieUser

  const bearerToken = extractBearerToken(request)
  if (!bearerToken) return null

  const anonKey = supabaseApiKey()
  if (anonKey) {
    const viaGlobalHeader = await fetchUserViaGlobalAuthHeader(bearerToken, anonKey)
    if (viaGlobalHeader) return viaGlobalHeader
  }

  const admin = createAdminClient()
  if (admin) {
    const { data: { user }, error } = await admin.auth.getUser(bearerToken)
    if (user && !error) return user
    if (error) {
      console.warn('resolveApiUser: service-role getUser failed', error.message)
    }
  }

  const viaAuthApi = await fetchUserViaAuthApi(bearerToken)
  if (viaAuthApi) return viaAuthApi

  if (anonKey) {
    const viaAnon = await fetchUserViaSupabaseClient(bearerToken, anonKey)
    if (viaAnon) return viaAnon
  }

  const jwtRef = jwtProjectRef(bearerToken)
  const serverRef = serverProjectRef()
  if (jwtRef && serverRef && jwtRef !== serverRef) {
    console.warn('resolveApiUser: JWT project mismatch', { jwtRef, serverRef })
  } else {
    console.warn('resolveApiUser: bearer validation failed', { jwtRef, serverRef })
  }

  return null
}
