import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/account/delete
 * Deletes the authenticated user's account and all associated data.
 * Uses Supabase Auth admin API; RLS and DB cascades handle related rows (profiles, bookings, etc.).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    let user = (await supabase.auth.getUser()).data.user

    const authHeader = request.headers.get('authorization')
    if (!user && authHeader?.startsWith('Bearer ')) {
      const { createClient: createSupabase } = await import('@supabase/supabase-js')
      const client = createSupabase(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: authHeader } } }
      )
      user = (await client.auth.getUser()).data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'Account deletion is not available' },
        { status: 503 }
      )
    }

    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) {
      console.error('Account delete error:', error)
      return NextResponse.json(
        { error: error.message ?? 'Failed to delete account' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Account delete error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
