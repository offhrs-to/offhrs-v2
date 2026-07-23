'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

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
      <Button
        type="button"
        variant="link"
        onClick={handleClick}
        disabled={loading}
        className="h-auto shrink-0 p-0 text-xs text-primary"
      >
        {loading ? 'Loading…' : 'Set up →'}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={handleClick}
      disabled={loading}
      className="h-8 shrink-0 bg-amber-100 text-amber-800 hover:bg-amber-200"
    >
      {loading ? 'Loading…' : 'Set up payouts'}
    </Button>
  )
}
