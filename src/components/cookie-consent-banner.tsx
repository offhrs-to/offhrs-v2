'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { readAdConsent, writeAdConsent, type AdConsentValue } from '@/lib/ad-consent'

function emitConsent() {
  window.dispatchEvent(new Event('offhrs-ad-consent'))
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(readAdConsent() === null)
  }, [])

  const choose = (value: AdConsentValue) => {
    writeAdConsent(value)
    emitConsent()
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-[#D5E0D5] bg-white/95 px-4 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <p className="text-sm leading-relaxed text-[#3d3d3d]">
          We use the Meta Pixel (Facebook / Instagram) to measure and improve our ads if you allow it.
          Necessary cookies for sign-in and payments always run.{' '}
          <Link href="/terms/cookies" className="font-medium text-[#5D755D] underline-offset-2 hover:underline">
            Cookie Policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose('declined')}
            className="rounded-full border border-[#D5E0D5] px-4 py-2 text-sm font-semibold text-[#3d3d3d] hover:bg-[#F5F7F5]"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose('accepted')}
            className="rounded-full bg-[#5D755D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4a5f4a]"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
