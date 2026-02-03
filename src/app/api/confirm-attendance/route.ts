import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/profile?error=invalid_token', request.url))
  }

  const supabase = await createClient()

  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, user_id, event_id, status')
    .eq('confirmation_token', token)
    .maybeSingle()

  if (fetchError || !booking) {
    return NextResponse.redirect(new URL('/profile?error=invalid_token', request.url))
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('experience_points, expertise_level')
    .eq('id', booking.user_id)
    .single()

  const currentPoints = profile?.experience_points ?? 0
  const newPoints = currentPoints + 1

  const levelThresholds: Record<string, number> = {
    Novice: 10,
    Intermediate: 20,
    Advanced: 40,
    Expert: 80,
    Master: Infinity,
  }
  const levels = ['Novice', 'Intermediate', 'Advanced', 'Expert', 'Master'] as const
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
