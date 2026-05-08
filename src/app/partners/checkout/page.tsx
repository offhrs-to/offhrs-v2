'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function PartnersCheckoutPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canceled, setCanceled] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setCanceled(params.get('canceled') === '1')
  }, [])

  async function startCheckout() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/partners/checkout', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Failed to start checkout')
      }
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
      setLoading(false)
    }
  }

  useEffect(() => {
    void startCheckout()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#E8E6E0] bg-white p-8 text-center space-y-4">
        <div className="text-4xl">{loading ? '⏳' : canceled ? '🧾' : '💳'}</div>
        <h1 className="font-playfair text-2xl font-bold text-[#1a1a1a]">
          {loading ? 'Redirecting to secure checkout…' : 'Continue your setup'}
        </h1>
        <p className="text-sm text-[#555] leading-relaxed">
          {canceled
            ? 'Checkout was canceled. You can restart your 7-day trial below.'
            : 'You need to complete billing setup to activate your vendor account.'}
        </p>

        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={() => void startCheckout()}
          disabled={loading}
          className="w-full rounded-lg bg-[#5D755D] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4d634d] disabled:opacity-60 transition-colors"
        >
          {loading ? 'Starting checkout…' : 'Start 7-day trial'}
        </button>

        <p className="text-xs text-[#999]">
          Prefer to exit?{' '}
          <Link href="/partners/login" className="text-[#5D755D] underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}
