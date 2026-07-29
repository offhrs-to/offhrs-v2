'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { OffhrsLogoLink } from '@/components/offhrs-logo'
import { createClient } from '@/lib/supabase/browser'

export default function PartnerUpdatePasswordPage() {
  const router = useRouter()
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [passwords, setPasswords] = useState({ next: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session))
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (passwords.next.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (passwords.next !== passwords.confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password: passwords.next })
      if (updateError) throw updateError
      setSuccess(true)
      setTimeout(() => router.replace('/partners/dashboard'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  if (hasSession === false) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="font-playfair text-2xl font-bold text-[#1a1a1a]">Link expired</h1>
          <p className="text-[#555] text-sm">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link href="/partners/reset-password" className="text-sm text-[#5D755D] underline">
            Request a new reset link
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
          <h1 className="font-playfair text-3xl font-bold text-[#1a1a1a]">Set a new password</h1>
          <p className="mt-2 text-[#555] text-sm">Choose a new password for your partner account.</p>
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
          {success && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-100 text-green-700 text-sm">
              Password updated. Redirecting to your dashboard…
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="next" className="block text-sm font-medium text-[#1a1a1a]">
              New password
            </label>
            <input
              id="next"
              type="password"
              required
              minLength={8}
              value={passwords.next}
              onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
              placeholder="••••••••"
              className="w-full rounded-lg border border-[#D9D7CF] bg-[#FAFAF8] px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#AAA] focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="confirm" className="block text-sm font-medium text-[#1a1a1a]">
              Confirm new password
            </label>
            <input
              id="confirm"
              type="password"
              required
              minLength={8}
              value={passwords.confirm}
              onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
              placeholder="••••••••"
              className="w-full rounded-lg border border-[#D9D7CF] bg-[#FAFAF8] px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#AAA] focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          </div>

          <button
            type="submit"
            disabled={loading || success || hasSession === null}
            className="w-full rounded-lg bg-[#5D755D] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4d634d] disabled:opacity-60 transition-colors"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
