import type { Metadata } from 'next'
import { PartnerFaqAccordion } from '@/components/partners/PartnerFaqAccordion'

export const metadata: Metadata = {
  title: 'Partner FAQ',
  description:
    'Answers to common partner questions about plans, payouts, fees, taxes, refunds, and managing your workshops on offhrs.',
}

export default function PartnerFaqPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-[#1a1a1a]">Partner FAQ</h1>
        <p className="text-sm text-[#555] mt-2 leading-relaxed">
          Answers to common questions about plans, payouts, fees, taxes, refunds, and managing your
          workshops on offhrs. Still stuck? Reach out to the offhrs team and we&apos;ll help.
        </p>
      </header>

      <PartnerFaqAccordion />
    </div>
  )
}
