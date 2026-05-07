import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type') ?? 'email'

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Supabase auth callback — exchange OTP token
    const otpToken = token ?? tokenHash
    if (!otpToken) {
      return NextResponse.json({ error: 'Missing verification token' }, { status: 400 })
    }

    const { data, error } = await admin.auth.verifyOtp({
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

    // Redirect to Stripe checkout page
    return NextResponse.redirect(`${APP_URL}/partners/checkout`)
  } catch (err) {
    console.error('Partner verify-email error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
