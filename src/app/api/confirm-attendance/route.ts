import { confirmAttendanceTokenSchema } from '@/lib/api-validation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRateLimitKey, rateLimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

const CONFIRM_RATE_LIMIT = 30 // per minute per IP (token guessing)

export async function GET(request: NextRequest) {
  const key = getRateLimitKey(request)
  if (!rateLimit(`confirm:${key}`, CONFIRM_RATE_LIMIT)) {
    if (request.headers.get('accept')?.includes('application/json')) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    return NextResponse.redirect(new URL('/profile?error=too_many_requests', request.url))
  }

  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token || !confirmAttendanceTokenSchema.safeParse(token).success) {
    return NextResponse.redirect(new URL('/profile?error=invalid_token', request.url))
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const authHeader = request.headers.get('authorization')
  let resolvedUser = user
  if (!resolvedUser && authHeader?.startsWith('Bearer ')) {
    const { createClient: createSupabase } = await import('@supabase/supabase-js')
    const client = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    )
    resolvedUser = (await client.auth.getUser()).data.user
  }

  // Use admin client so we can find the booking by token even when user has no session
  // (e.g. clicking the link from email on a different device). The token is secret so this is safe.
  const admin = createAdminClient()
  const clientToFetch = admin ?? supabase
  const { data: booking, error: fetchError } = await clientToFetch
    .from('bookings')
    .select('id, user_id, event_id, status')
    .eq('confirmation_token', token)
    .maybeSingle()

  if (fetchError || !booking) {
    return NextResponse.redirect(new URL('/profile?error=invalid_token', request.url))
  }

  if (resolvedUser && booking.user_id !== resolvedUser.id) {
    return NextResponse.redirect(new URL('/profile?error=forbidden', request.url))
  }

  if (booking.status === 'attended') {
    return NextResponse.redirect(new URL('/profile?already_confirmed=true', request.url))
  }

  // Use admin client for update so it succeeds regardless of session (e.g. email link click with no cookies)
  const clientToUpdate = admin ?? supabase
  const { error: updateError } = await clientToUpdate
    .from('bookings')
    .update({ status: 'attended' })
    .eq('id', booking.id)

  if (updateError) {
    return NextResponse.redirect(new URL('/profile?error=confirm_failed', request.url))
  }

  const levelThresholds: Record<string, number> = {
    Novice: 8,
    Intermediate: 16,
    Advanced: 24,
    Expert: 32,
    Master: Infinity,
  }
  const levels = ['Novice', 'Intermediate', 'Advanced', 'Expert', 'Master'] as const

  // Use admin for reads/writes on behalf of booking.user_id (works when user opened link with no session)
  const db = admin ?? supabase

  const { data: event } = await db
    .from('events')
    .select('category, duration_weeks')
    .eq('id', booking.event_id)
    .single()

  const eventCategory = event?.category?.trim() || null
  const pointsToAdd = Math.max(1, event?.duration_weeks ?? 1)

  if (eventCategory) {
    const { data: catRow } = await db
      .from('profile_category_experience')
      .select('experience_points, expertise_level')
      .eq('user_id', booking.user_id)
      .eq('category', eventCategory)
      .maybeSingle()

    const currentPoints = catRow?.experience_points ?? 0
    const newPoints = currentPoints + pointsToAdd
    const currentLevel = (catRow?.expertise_level as (typeof levels)[number]) || 'Novice'
    const currentIndex = levels.indexOf(currentLevel)
    const nextLevel = levels[Math.min(currentIndex + 1, levels.length - 1)]!
    const threshold = levelThresholds[currentLevel] ?? 8
    const newLevel = newPoints >= threshold ? nextLevel : currentLevel

    await db.from('profile_category_experience').upsert(
      {
        user_id: booking.user_id,
        category: eventCategory,
        expertise_level: newLevel,
        experience_points: newPoints,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,category' }
    )
  }

  const { data: profile } = await db
    .from('profiles')
    .select('experience_points, expertise_level')
    .eq('id', booking.user_id)
    .single()

  const currentPoints = profile?.experience_points ?? 0
  const newPoints = currentPoints + pointsToAdd
  const currentLevel = profile?.expertise_level || 'Novice'
  const currentIndex = levels.indexOf(currentLevel)
  const nextLevel = levels[Math.min(currentIndex + 1, levels.length - 1)]!
  const threshold = levelThresholds[currentLevel] ?? 8
  const newLevel = newPoints >= threshold ? nextLevel : currentLevel

  await db
    .from('profiles')
    .update({
      experience_points: newPoints,
      expertise_level: newLevel,
    })
    .eq('id', booking.user_id)

  return NextResponse.redirect(new URL('/profile?attendance_confirmed=true', request.url))
}
