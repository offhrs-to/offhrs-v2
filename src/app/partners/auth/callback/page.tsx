'use client'

import { createClient } from '@/lib/supabase/browser'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {}
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash
  trimmed.split('&').forEach((pair) => {
    const [k, v] = pair.split('=')
    if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '))
  })
  return params
}

export default function PartnerAuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    const search = window.location.search
    const hash = window.location.hash
    const params = new URLSearchParams(search)
    const code = params.get('code')
    const next = params.get('next') || '/partners/dashboard'
    const hashParams = parseHashParams(hash)
    const access_token = hashParams.access_token
    const refresh_token = hashParams.refresh_token

    const redirectError = () => {
      setStatus('error')
      router.replace('/partners/login?error=auth_failed')
    }
    const redirectOk = () => {
      setStatus('ok')
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
          redirectError()
          return
        }
        redirectOk()
        return
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          redirectError()
          return
        }
        redirectOk()
        return
      }

      redirectError()
    }

    run()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-600">
        {status === 'loading' && 'Completing sign in…'}
        {status === 'ok' && 'Redirecting…'}
        {status === 'error' && 'Redirecting…'}
      </p>
    </div>
  )
}
