import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function getAppUrl(request: NextRequest): string {
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  if (host) return `${proto}://${host}`

  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

export async function GET(request: NextRequest) {
  try {
    const appUrl = getAppUrl(request)
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type') ?? 'signup'

    // Use regular Supabase server client so verifyOtp sets auth cookies.
    const supabase = await createClient()
    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Supabase auth callback — exchange OTP token and establish session.
    const otpToken = token ?? tokenHash
    if (!otpToken) {
      return NextResponse.json({ error: 'Missing verification token' }, { status: 400 })
    }

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: otpToken,
      type: type as 'email' | 'signup',
    })

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message ?? 'Invalid or expired verification link' },
        { status: 400 }
      )
    }

    // Mark email_verified on vendor profile
    await admin
      .from('vendor_profiles')
      .update({ email_verified: true })
      .eq('user_id', data.user.id)

    // Continue onboarding: payment step in signup wizard
    return NextResponse.redirect(`${appUrl}/partners/signup?billing=1`)
  } catch (err) {
    console.error('Partner verify-email error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

