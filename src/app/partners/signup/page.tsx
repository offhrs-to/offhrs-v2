import Link from 'next/link'
import { PartnerSignupWizard } from './PartnerSignupWizard'

export default function PartnerSignupPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1a1a1a]">
      <div className="absolute top-4 left-4 z-10 sm:top-6 sm:left-6">
        <Link
          href="/partners"
          className="font-playfair text-2xl font-bold tracking-tight text-[#1a1a1a] hover:opacity-80 transition-opacity"
        >
          offhrs
        </Link>
      </div>
      <PartnerSignupWizard />
    </div>
  )
}
