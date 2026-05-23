'use client'

import { useState } from 'react'
import Link from 'next/link'
import { OffhrsLogoLink } from '@/components/offhrs-logo'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

export default function PartnerLoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ email: '', password: '' })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })

      if (signInError) throw signInError

      router.replace('/partners/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password')
    } finally {
      setLoading(false)
    }
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
          <h1 className="font-playfair text-3xl font-bold text-[#1a1a1a]">Welcome back</h1>
          <p className="mt-2 text-[#555] text-sm">Sign in to your partner dashboard</p>
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
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="you@yourstudio.com"
              className="w-full rounded-lg border border-[#D9D7CF] bg-[#FAFAF8] px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#AAA] focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-[#1a1a1a]">
                Password
              </label>
              <Link
                href="/partners/reset-password"
                className="text-xs text-[#5D755D] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full rounded-lg border border-[#D9D7CF] bg-[#FAFAF8] px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#AAA] focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#5D755D] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4d634d] disabled:opacity-60 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-[#555]">
          Don&apos;t have an account?{' '}
          <Link href="/partners/signup" className="font-medium text-[#5D755D] underline">
            Start free trial
          </Link>
        </p>
      </div>
    </div>
  )
}
