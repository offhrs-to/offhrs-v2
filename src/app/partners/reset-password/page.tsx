'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { OffhrsLogoLink } from '@/components/offhrs-logo'
import { createClient } from '@/lib/supabase/browser'

function PartnerResetPasswordForm() {
  const searchParams = useSearchParams()
  const linkError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(linkError)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const origin = window.location.origin
      const supabase = createClient()
      // Server confirm exchanges the code / token_hash and sets auth cookies,
      // then sends the user to the update-password form.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/api/partners/auth/confirm?next=${encodeURIComponent('/partners/update-password')}`,
      })
      if (resetError) throw resetError
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-4xl">📬</div>
          <h1 className="font-playfair text-2xl font-bold text-[#1a1a1a]">Check your inbox</h1>
          <p className="text-[#555] text-sm">
            We sent a password reset link to <strong>{email}</strong>. Open it in this same browser
            for best results.
          </p>
          <Link href="/partners/login" className="text-sm text-[#5D755D] underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <OffhrsLogoLink
            href="/partners"
            linkClassName="inline-flex justify-center mb-6"
            className="h-9 w-auto max-w-[170px] object-contain mx-auto"
            width={200}
            height={48}
          />
          <h1 className="font-playfair text-3xl font-bold text-[#1a1a1a]">Reset password</h1>
          <p className="mt-2 text-[#555] text-sm">
            Enter your email and we&apos;ll send a reset link.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-[#E8E6E0] shadow-sm p-8 space-y-5"
        >
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-[#1a1a1a]">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourstudio.com"
              className="w-full rounded-lg border border-[#D9D7CF] bg-[#FAFAF8] px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#AAA] focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#5D755D] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4d634d] disabled:opacity-60 transition-colors"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="text-center text-sm text-[#555]">
          Remember your password?{' '}
          <Link href="/partners/login" className="font-medium text-[#5D755D] underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function PartnerResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-[#555]">
          Loading…
        </div>
      }
    >
      <PartnerResetPasswordForm />
    </Suspense>
  )
}
