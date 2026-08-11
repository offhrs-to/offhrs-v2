'use client'

import { createClient } from '@/lib/supabase/browser'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { EmailOtpType } from '@supabase/supabase-js'

function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {}
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash
  trimmed.split('&').forEach((pair) => {
    const [k, v] = pair.split('=')
    if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '))
  })
  return params
}

function safePartnerNext(raw: string | null, fallback: string): string {
  if (!raw) return fallback
  if (!raw.startsWith('/partners/') && raw !== '/partners') return fallback
  if (raw.startsWith('//') || raw.includes('\\')) return fallback
  return raw
}

/**
 * Client fallback for auth redirects that land with hash tokens.
 * Prefer `/api/partners/auth/confirm` for email recovery (PKCE + token_hash).
 */
export default function PartnerAuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('Completing sign in…')

  useEffect(() => {
    const search = window.location.search
    const hash = window.location.hash
    const params = new URLSearchParams(search)
    const code = params.get('code')
    const tokenHash = params.get('token_hash') ?? params.get('token')
    const type = params.get('type')
    const hashParams = parseHashParams(hash)
    const access_token = hashParams.access_token
    const refresh_token = hashParams.refresh_token
    const hashType = hashParams.type

    const isRecovery = type === 'recovery' || hashType === 'recovery'
    const next = safePartnerNext(
      params.get('next'),
      isRecovery ? '/partners/update-password' : '/partners/dashboard'
    )

    // Prefer server confirm for query-based links (sets httpOnly-compatible cookies).
    if ((code || (tokenHash && type)) && !access_token) {
      const confirm = new URL('/api/partners/auth/confirm', window.location.origin)
      params.forEach((value, key) => confirm.searchParams.set(key, value))
      if (!confirm.searchParams.get('next')) confirm.searchParams.set('next', next)
      window.location.replace(confirm.pathname + confirm.search)
      return
    }

    const redirectError = (reason: string) => {
      setStatus('error')
      setMessage(reason)
      router.replace(`/partners/reset-password?error=${encodeURIComponent(reason)}`)
    }
    const redirectOk = () => {
      setStatus('ok')
      setMessage('Redirecting…')
      router.replace(next)
    }

    const run = async () => {
      const supabase = createClient()

      if (access_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token: refresh_token ?? '',
        })
        if (error) {
          redirectError('This link is invalid or has expired. Request a new password reset.')
          return
        }
        redirectOk()
        return
      }

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as EmailOtpType,
        })
        if (error) {
          redirectError('This link is invalid or has expired. Request a new password reset.')
          return
        }
        redirectOk()
        return
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          redirectError(
            'This reset link is invalid or expired, or was opened in a different browser. Request a new one.'
          )
          return
        }
        redirectOk()
        return
      }

      redirectError('Missing authentication token. Request a new password reset email.')
    }

    void run()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <p className="text-gray-600 text-sm text-center max-w-sm">{message}</p>
      {status === 'error' ? (
        <p className="sr-only">Redirecting to password reset…</p>
      ) : null}
    </div>
  )
}
