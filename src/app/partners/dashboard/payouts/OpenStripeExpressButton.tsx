'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'

export function OpenStripeExpressButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/partners/stripe-express-login', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank')
      } else {
        alert(data.error ?? 'Could not open Stripe dashboard.')
      }
    } catch {
      alert('Failed to open Stripe dashboard.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 text-sm font-semibold text-[#5D755D] border border-[#5D755D] px-4 py-2.5 rounded-xl hover:bg-[#EDF2ED] disabled:opacity-50 transition-colors"
    >
      <ExternalLink className="w-4 h-4" />
      {loading ? 'Opening…' : 'Open Stripe dashboard'}
    </button>
  )
}
