import { Suspense } from 'react'
import { OffhrsLogoLink } from '@/components/offhrs-logo'
import { PartnerSignupWizard } from './PartnerSignupWizard'

export default function PartnerSignupPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1a1a1a]">
      <div className="absolute top-4 left-4 z-10 sm:top-6 sm:left-6">
        <OffhrsLogoLink
          href="/partners"
          linkClassName="inline-flex hover:opacity-80 transition-opacity"
          className="h-8 w-auto max-w-[150px] object-contain"
          width={180}
          height={44}
        />
      </div>
      <Suspense fallback={<div className="min-h-screen pt-28 flex justify-center text-sm text-[#888]">Loading…</div>}>
        <PartnerSignupWizard />
      </Suspense>
    </div>
  )
}
