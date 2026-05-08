'use client'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function VerifyEmailPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setError('No verification token found.')
      return
    }

    fetch(`/api/partners/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? 'Verification failed')
        }
        setStatus('success')
        setTimeout(() => router.replace('/partners/checkout'), 2000)
      })
      .catch((err) => {
        setStatus('error')
        setError(err.message)
      })
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        {status === 'verifying' && (
          <>
            <div className="text-4xl animate-pulse">⏳</div>
            <h1 className="font-playfair text-2xl font-bold text-[#1a1a1a]">Verifying your email…</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-4xl">✅</div>
            <h1 className="font-playfair text-2xl font-bold text-[#1a1a1a]">Email verified!</h1>
            <p className="text-[#555] text-sm">Redirecting you to set up billing…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl">❌</div>
            <h1 className="font-playfair text-2xl font-bold text-[#1a1a1a]">Verification failed</h1>
            <p className="text-[#555] text-sm">{error}</p>
            <Link href="/partners/signup" className="text-sm text-[#5D755D] underline">
              Try signing up again
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">⏳</div></div>}>
      <VerifyEmailPageInner />
    </Suspense>
  )
}
