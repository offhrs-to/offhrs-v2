import { NextRequest, NextResponse } from 'next/server'

/**
 * @deprecated Attendance and XP are credited automatically after the workshop ends.
 * Legacy email links redirect here; send users to profile instead.
 */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/profile?attendance_auto=true', request.url))
}
