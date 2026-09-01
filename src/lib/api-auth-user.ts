import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

/** Resolve authenticated user from cookie session or Bearer token (mobile). */
export async function resolveApiUser(request: NextRequest): Promise<User | null> {
  const supabase = await createClient()
  let user = (await supabase.auth.getUser()).data.user

  const authHeader = request.headers.get('authorization')
  if (!user && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { createClient: createSupabase } = await import('@supabase/supabase-js')
    const client = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    user = (await client.auth.getUser()).data.user
  }

  return user
}
