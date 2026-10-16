'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { OffhrsLogoLink } from '@/components/offhrs-logo'
import { createClient } from '@/lib/supabase/browser'
import {
  CURRENT_POLICY_VERSION,
  PARTNER_CLICKWRAP_LINKS,
} from '@/lib/legal-acceptances-client'

export default function PartnerAcceptTermsPage() {
  const router = useRouter()
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        window.location.replace(
          `/partners/login?next=${encodeURIComponent('/partners/accept-terms')}`
        )
        return
      }
      const statusRes = await fetch('/api/partners/legal/accept')
      if (statusRes.ok) {
        const status = (await statusRes.json()) as { accepted?: boolean }
        if (status.accepted) {
          router.replace('/partners/dashboard')
          return
        }
      }
      if (!cancelled) setCheckingSession(false)
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  async function submit() {
    if (!accepted) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/partners/legal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true, context: 'partner_reaccept' }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Could not save acceptance')
      router.replace('/partners/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4 py-12">
        <p className="text-sm text-[#555]">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-[#E8E6E0] bg-white p-8 shadow-sm">
        <OffhrsLogoLink
          href="/partners"
          linkClassName="inline-flex"
          className="h-8 w-auto max-w-[160px] object-contain"
          width={180}
          height={40}
        />
        <div className="space-y-2">
          <h1 className="font-playfair text-2xl font-bold text-[#1a1a1a]">
            Updated partner Terms
          </h1>
          <p className="text-sm text-[#555] leading-relaxed">
            Please review and accept our current partner Terms (last updated{' '}
            {CURRENT_POLICY_VERSION}) to continue to your dashboard. This is a one-time step when
            Terms change.
          </p>
        </div>

        <ul className="list-disc space-y-1 pl-5 text-sm text-[#555]">
          {PARTNER_CLICKWRAP_LINKS.map((doc) => (
            <li key={doc.key}>
              <a
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#5D755D] underline hover:text-[#4d634d]"
              >
                {doc.title}
              </a>
            </li>
          ))}
        </ul>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#D9D7CF] text-[#5D755D] focus:ring-[#5D755D]"
          />
          <span className="text-sm text-[#1a1a1a] leading-relaxed">
            I have read and agree to the Terms of Use, Privacy Policy, Data Protection Addendum, and
            Marketplace Seller Addendum.
          </span>
        </label>

        {error ? (
          <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!accepted || loading}
          onClick={() => void submit()}
          className="w-full rounded-lg bg-[#5D755D] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4d634d] disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          {loading ? 'Saving…' : 'Accept and continue'}
        </button>

        <p className="text-center text-xs text-[#999]">
          <Link href="/partners/login" className="text-[#5D755D] underline">
            Sign in with a different account
          </Link>
        </p>
      </div>
    </div>
  )
}
