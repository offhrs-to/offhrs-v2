'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function EnableMarketplaceButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enroll() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/partners/marketplace/enroll', { method: 'POST' })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not enable Marketplace')
      router.push('/partners/dashboard/marketplace')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enable Marketplace')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-partner-border mt-1"
        disabled={loading}
        onClick={() => void enroll()}
      >
        {loading ? 'Enabling…' : 'Enable Marketplace'}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
