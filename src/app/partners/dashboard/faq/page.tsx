import type { Metadata } from 'next'
import { PartnerFaqAccordion } from '@/components/partners/PartnerFaqAccordion'

export const metadata: Metadata = {
  title: 'Partner FAQ',
  description:
    'Answers to common partner questions about plans, payouts, fees, taxes, refunds, and managing your workshops on offhrs.',
}

export default function PartnerFaqPage() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Partner FAQ</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Answers to common questions about plans, payouts, fees, taxes, refunds, and managing your workshops on
          offhrs. Still stuck? Reach out to the offhrs team and we&apos;ll help.
        </p>
      </header>

      <PartnerFaqAccordion />
    </div>
  )
}
