'use client'

import { useState } from 'react'

export function ConnectStripeButton({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/partners/connect-stripe', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
      }
    } catch {
      alert('Failed to connect. Please try again.')
      setLoading(false)
    }
  }

  if (compact) {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-xs font-medium text-[#5D755D] hover:underline flex-shrink-0 disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'Set up →'}
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
    >
      {loading ? 'Loading…' : 'Set up payouts'}
    </button>
  )
}
