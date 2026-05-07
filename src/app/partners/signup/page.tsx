'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function PartnerSignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    business_name: '',
    email: '',
    password: '',
    phone: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/partners/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Signup failed')

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-4xl">📬</div>
          <h1 className="font-playfair text-2xl font-bold text-[#1a1a1a]">Check your inbox</h1>
          <p className="text-[#555] text-sm leading-relaxed">
            We sent a verification link to <strong>{form.email}</strong>. Click it to continue
            setting up your offhrs account.
          </p>
          <p className="text-xs text-[#999]">
            Already verified?{' '}
            <Link href="/partners/login" className="text-[#5D755D] underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/partners" className="inline-block mb-6">
            <span className="font-playfair text-2xl font-bold tracking-tight text-[#1a1a1a]">
              offhrs
            </span>
          </Link>
          <h1 className="font-playfair text-3xl font-bold text-[#1a1a1a]">Start your free trial</h1>
          <p className="mt-2 text-[#555] text-sm">7 days free, then $79 CAD/month. Cancel anytime.</p>
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
            <label htmlFor="business_name" className="block text-sm font-medium text-[#1a1a1a]">
              Business name
            </label>
            <input
              id="business_name"
              name="business_name"
              type="text"
              required
              value={form.business_name}
              onChange={handleChange}
              placeholder="e.g. Clay & Co Studio"
              className="w-full rounded-lg border border-[#D9D7CF] bg-[#FAFAF8] px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#AAA] focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-[#1a1a1a]">
              Work email
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
            <label htmlFor="phone" className="block text-sm font-medium text-[#1a1a1a]">
              Phone number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="+1 (416) 555-0100"
              className="w-full rounded-lg border border-[#D9D7CF] bg-[#FAFAF8] px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#AAA] focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-[#1a1a1a]">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={handleChange}
              placeholder="Minimum 8 characters"
              className="w-full rounded-lg border border-[#D9D7CF] bg-[#FAFAF8] px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#AAA] focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#5D755D] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4d634d] disabled:opacity-60 transition-colors"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <p className="text-center text-xs text-[#999] leading-relaxed">
            By signing up you agree to our{' '}
            <Link href="/terms" className="text-[#5D755D] underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-[#5D755D] underline">
              Privacy Policy
            </Link>
            .
          </p>
        </form>

        <p className="text-center text-sm text-[#555]">
          Already have an account?{' '}
          <Link href="/partners/login" className="font-medium text-[#5D755D] underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
