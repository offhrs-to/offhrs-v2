'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
      className="border-primary text-primary hover:bg-partner-tint"
    >
      <ExternalLink className="size-4" />
      {loading ? 'Opening…' : 'Open Stripe dashboard'}
    </Button>
  )
}
