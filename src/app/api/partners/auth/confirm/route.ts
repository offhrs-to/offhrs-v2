import { createServerClient } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const OTP_TYPES = new Set<string>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
])

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

/** Only allow relative partner paths (open-redirect safe). */
function safePartnerNext(raw: string | null, fallback: string): string {
  if (!raw) return fallback
  if (!raw.startsWith('/partners/') && raw !== '/partners') return fallback
  if (raw.startsWith('//') || raw.includes('\\')) return fallback
  return raw
}

/**
 * Completes partner auth email links (password recovery, etc.).
 *
 * Handles:
 * - PKCE `?code=` (default resetPasswordForEmail redirect)
 * - `?token_hash=&type=` (custom Recovery email templates)
 *
 * Prefer this over the client callback for recovery so the session is set in
 * cookies even when the browser client cannot exchange the code alone.
 */
export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request)
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash') ?? searchParams.get('token')
  const typeRaw = searchParams.get('type')
  const next = safePartnerNext(
    searchParams.get('next'),
    typeRaw === 'recovery' ? '/partners/update-password' : '/partners/dashboard'
  )

  const loginError = (reason: string) =>
    NextResponse.redirect(
      `${appUrl}/partners/reset-password?error=${encodeURIComponent(reason)}`
    )

  let response = NextResponse.redirect(`${appUrl}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.redirect(`${appUrl}${next}`)
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('[partners/auth/confirm] exchangeCodeForSession', error.message)
        return loginError(
          'This reset link is invalid or expired, or was opened in a different browser. Request a new one.'
        )
      }
      return response
    }

    if (tokenHash && typeRaw && OTP_TYPES.has(typeRaw)) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: typeRaw as EmailOtpType,
      })
      if (error) {
        console.error('[partners/auth/confirm] verifyOtp', error.message)
        return loginError('This reset link is invalid or has expired. Request a new one.')
      }
      return response
    }

    return loginError('Missing reset token. Request a new password reset email.')
  } catch (err) {
    console.error('[partners/auth/confirm]', err)
    return loginError('Could not complete password reset. Request a new link.')
  }
}
