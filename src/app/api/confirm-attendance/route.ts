import { confirmAttendanceTokenSchema } from '@/lib/api-validation'
import { createClient } from '@/lib/supabase/server'
import { getRateLimitKey, rateLimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

const CONFIRM_RATE_LIMIT = 30 // per minute per IP (token guessing)

export async function GET(request: NextRequest) {
  const key = getRateLimitKey(request)
  if (!rateLimit(`confirm:${key}`, CONFIRM_RATE_LIMIT)) {
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

  const { data: booking, error: fetchError } = await supabase
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

  const { error: updateError } = await supabase
    .from('bookings')
    .update({ status: 'attended' })
    .eq('id', booking.id)

  if (updateError) {
    return NextResponse.redirect(new URL('/profile?error=confirm_failed', request.url))
  }

  const levelThresholds: Record<string, number> = {
    Novice: 10,
    Intermediate: 20,
    Advanced: 30,
    Expert: 40,
    Master: Infinity,
  }
  const levels = ['Novice', 'Intermediate', 'Advanced', 'Expert', 'Master'] as const

  const { data: event } = await supabase
    .from('events')
    .select('category')
    .eq('id', booking.event_id)
    .single()

  const eventCategory = event?.category?.trim() || null

  if (eventCategory) {
    const { data: catRow } = await supabase
      .from('profile_category_experience')
      .select('experience_points, expertise_level')
      .eq('user_id', booking.user_id)
      .eq('category', eventCategory)
      .maybeSingle()

    const currentPoints = catRow?.experience_points ?? 0
    const newPoints = currentPoints + 1
    const currentLevel = (catRow?.expertise_level as (typeof levels)[number]) || 'Novice'
    const currentIndex = levels.indexOf(currentLevel)
    const nextLevel = levels[Math.min(currentIndex + 1, levels.length - 1)]!
    const threshold = levelThresholds[currentLevel] ?? 10
    const newLevel = newPoints >= threshold ? nextLevel : currentLevel

    await supabase.from('profile_category_experience').upsert(
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('experience_points, expertise_level')
    .eq('id', booking.user_id)
    .single()

  const currentPoints = profile?.experience_points ?? 0
  const newPoints = currentPoints + 1
  const currentLevel = profile?.expertise_level || 'Novice'
  const currentIndex = levels.indexOf(currentLevel)
  const nextLevel = levels[Math.min(currentIndex + 1, levels.length - 1)]!
  const threshold = levelThresholds[currentLevel] ?? 10
  const newLevel = newPoints >= threshold ? nextLevel : currentLevel

  await supabase
    .from('profiles')
    .update({
      experience_points: newPoints,
      expertise_level: newLevel,
    })
    .eq('id', booking.user_id)

  return NextResponse.redirect(new URL('/profile?attendance_confirmed=true', request.url))
}
