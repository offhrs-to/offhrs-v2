import type { Metadata } from 'next'
import Link from 'next/link'
import { OffhrsLogoLink } from '@/components/offhrs-logo'
import { PartnerFaqAccordion } from '@/components/partners/PartnerFaqAccordion'
import { PartnerSetupVideos } from '@/components/partners/PartnerSetupVideos'
import {
  formatPartnerMonthlyAmount,
  formatPartnerMonthlyPriceLabel,
  formatPartnerPlansFromLine,
  PARTNER_PLAN_MONTHLY_CAD,
  PARTNER_TRIAL_LABEL,
  PARTNER_TRIAL_LABEL_LONG,
  SHOPIFY_SYNC_MONTHLY_CAD,
  SHOPIFY_SYNC_PLAN_NAME,
} from '@/lib/partner-pricing'
import { flattenPartnerFaqs } from '@/lib/partner-faq'
import { getSiteUrl } from '@/lib/site'

const site = getSiteUrl()

export const metadata: Metadata = {
  title: 'offhrs Partners — Run your workshop business the easy way',
  description: `offhrs Partners: Marketplace free; Lite $${PARTNER_PLAN_MONTHLY_CAD.lite}; Shopify Sync $${SHOPIFY_SYNC_MONTHLY_CAD}; Pro $${PARTNER_PLAN_MONTHLY_CAD.pro}; Full License $${PARTNER_PLAN_MONTHLY_CAD.full} CAD/month. Start your free ${PARTNER_TRIAL_LABEL}.`,
  alternates: { canonical: `${site}/partners` },
  openGraph: {
    title: 'offhrs Partners — workshops, Marketplace & Shopify Sync',
    description: `Marketplace free · Lite $${PARTNER_PLAN_MONTHLY_CAD.lite} · Sync $${SHOPIFY_SYNC_MONTHLY_CAD} · Pro $${PARTNER_PLAN_MONTHLY_CAD.pro} · Full $${PARTNER_PLAN_MONTHLY_CAD.full}/mo after a ${PARTNER_TRIAL_LABEL}.`,
    url: `${site}/partners`,
    siteName: 'offhrs',
    type: 'website',
    locale: 'en_CA',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'offhrs' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'offhrs Partners',
    description: 'All-in-one booking, payouts, and calendar sync for workshop vendors.',
    images: ['/twitter-image'],
  },
}

const features = [
  {
    icon: '📅',
    title: 'Instant booking',
    description:
      'Attendees book and pay in one flow. No back-and-forth, no manual confirmations.',
  },
  {
    icon: '💳',
    title: 'Stripe payouts',
    description:
      'Receive 100% of ticket revenue directly to your bank. Zero commission from offhrs.',
  },
  {
    icon: '🗓️',
    title: 'Google & Outlook sync',
    description:
      'Your workshop sessions appear in your personal calendar automatically — two-way.',
  },
  {
    icon: '🔒',
    title: 'Secure checkout',
    description:
      'Card payments run through Stripe — you never store or touch card numbers.',
  },
  {
    icon: '🎟️',
    title: 'Capacity management',
    description:
      'Set max attendees per session. Sessions are marked "Fully Booked" automatically.',
  },
  {
    icon: '📊',
    title: 'Revenue dashboard',
    description:
      'Track bookings, revenue, and upcoming sessions from a single clean dashboard.',
  },
]

export default function PartnersLandingPage() {
  const faqs = flattenPartnerFaqs()
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'offhrs Partners',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description:
          'SaaS booking engine for workshop vendors: instant booking, Stripe Connect payouts, and Google / Outlook calendar sync.',
        url: `${site}/partners`,
        offers: [
          {
            '@type': 'Offer',
            name: 'Marketplace Only',
            price: '0',
            priceCurrency: 'CAD',
            description: 'Sell physical goods on Artist Marketplace — no monthly fee; 5% + Stripe on sales',
          },
          {
            '@type': 'Offer',
            name: 'Lite',
            price: String(PARTNER_PLAN_MONTHLY_CAD.lite),
            priceCurrency: 'CAD',
            description: `Lite — up to 4 active workshops; no Marketplace; no Sync. After ${PARTNER_TRIAL_LABEL}`,
          },
          {
            '@type': 'Offer',
            name: SHOPIFY_SYNC_PLAN_NAME,
            price: String(SHOPIFY_SYNC_MONTHLY_CAD),
            priceCurrency: 'CAD',
            description: `Shopify Sync only — mirror tagged Shopify workshops into offhrs. After ${PARTNER_TRIAL_LABEL}`,
          },
          {
            '@type': 'Offer',
            name: 'Pro',
            price: String(PARTNER_PLAN_MONTHLY_CAD.pro),
            priceCurrency: 'CAD',
            description: `Pro — unlimited workshops + Marketplace. After ${PARTNER_TRIAL_LABEL}`,
          },
          {
            '@type': 'Offer',
            name: 'Full License',
            price: String(PARTNER_PLAN_MONTHLY_CAD.full),
            priceCurrency: 'CAD',
            description: `Full License — Pro + Marketplace + Shopify Sync. After ${PARTNER_TRIAL_LABEL}`,
          },
        ],
        publisher: {
          '@type': 'Organization',
          name: 'offhrs',
          url: site,
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a },
        })),
      },
    ],
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1a1a1a]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-[#FAFAF8]/90 backdrop-blur border-b border-[#E8E6E0]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <OffhrsLogoLink href="/" priority className="h-9 w-auto max-w-[180px]" width={220} height={52} />
          <div className="flex items-center gap-4">
            <Link
              href="/partners/login"
              className="text-sm text-[#555] hover:text-[#1a1a1a] transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/partners/signup"
              className="rounded-full bg-[#5D755D] px-5 py-2 text-sm font-semibold text-white hover:bg-[#4d634d] transition-colors"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <p className="inline-block rounded-full bg-[#EDF0ED] px-4 py-1 text-xs font-semibold text-[#5D755D] mb-6 tracking-wide uppercase">
          Toronto workshop vendors
        </p>
        <h1 className="font-playfair text-5xl md:text-6xl font-bold leading-tight tracking-tight max-w-3xl mx-auto">
          Run your workshop business the easy way — all in one platform.
        </h1>
        <p className="mt-6 text-lg text-[#555] max-w-xl mx-auto leading-relaxed">
          Bookings, payouts, and calendar sync — or mirror your Shopify workshops into the app. Start your free{' '}
          {PARTNER_TRIAL_LABEL}; plans from{' '}
          <span className="font-semibold text-[#1a1a1a]">{formatPartnerMonthlyPriceLabel('lite')}</span> after the trial.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/partners/signup"
            className="rounded-full bg-[#5D755D] px-8 py-3.5 text-sm font-semibold text-white hover:bg-[#4d634d] transition-colors shadow-sm"
          >
            Start free {PARTNER_TRIAL_LABEL}
          </Link>
          <Link
            href="/partners/login"
            className="rounded-full border border-[#D9D7CF] px-8 py-3.5 text-sm font-semibold text-[#1a1a1a] hover:bg-[#F0EDE8] transition-colors"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="bg-white border-y border-[#E8E6E0] py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="font-playfair text-3xl font-bold mb-4">How it works</h2>
          <p className="text-[#555] text-sm mb-14 max-w-md mx-auto">
            From signup to your first booking in under 15 minutes.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { step: '01', title: 'Sign up', body: `Create your account and start your free ${PARTNER_TRIAL_LABEL}. No upfront payment needed.` },
              { step: '02', title: 'Connect your calendar', body: 'Link Google or Outlook in one click. Your availability syncs automatically.' },
              { step: '03', title: 'Get bookings', body: 'Attendees discover and book your sessions on offhrs. Payments go straight to you.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <p className="font-playfair text-4xl font-bold text-[#D9D7CF] mb-3">{item.step}</p>
                <h3 className="font-semibold text-[#1a1a1a] mb-2">{item.title}</h3>
                <p className="text-sm text-[#555] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="font-playfair text-3xl font-bold mb-4">Everything you need</h2>
          <p className="text-[#555] text-sm max-w-md mx-auto">
            Built specifically for hands-on creative workshop vendors.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl bg-white border border-[#E8E6E0] p-6 space-y-3"
            >
              <div className="text-2xl">{f.icon}</div>
              <h3 className="font-semibold text-[#1a1a1a]">{f.title}</h3>
              <p className="text-sm text-[#555] leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section className="bg-white border-y border-[#E8E6E0] py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="font-playfair text-3xl font-bold mb-4">Simple, honest pricing</h2>
          <p className="text-[#555] text-sm mb-12 max-w-2xl mx-auto">
            Marketplace Only is free. Lite and Pro run bookings on offhrs (Pro includes Marketplace). Shopify Sync
            mirrors Shopify workshops. Full License bundles Pro + Marketplace + Sync. Paid plans include a{' '}
            {PARTNER_TRIAL_LABEL}.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left items-stretch">
            <div className="rounded-3xl border-2 border-[#E8E6E0] bg-[#FAFAF8] p-8 shadow-sm flex flex-col h-full">
              <p className="text-sm font-semibold text-[#5D755D] uppercase tracking-wide mb-3">Marketplace Only</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="font-playfair text-5xl font-bold text-[#1a1a1a]">$0</span>
                <span className="text-[#555] text-sm mb-2">to join</span>
              </div>
              <p className="text-xs text-[#5D755D] font-medium mb-6">No monthly fee · 5% + Stripe on sales</p>
              <ul className="space-y-3 text-sm text-[#333] mb-8 flex-1">
                {['Sell physical goods Canada-wide', 'No workshops dashboard', 'No Shopify Sync'].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-[#5D755D] mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/partners/signup?intent=marketplace"
                className="mt-auto block w-full rounded-full border-2 border-[#5D755D] bg-transparent px-6 py-3 text-center text-sm font-semibold text-[#5D755D] hover:bg-[#EDF0ED] transition-colors"
              >
                Join Marketplace
              </Link>
            </div>
            <div className="rounded-3xl border-2 border-[#E8E6E0] bg-[#FAFAF8] p-8 shadow-sm flex flex-col h-full">
              <p className="text-sm font-semibold text-[#5D755D] uppercase tracking-wide mb-3">Lite</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="font-playfair text-5xl font-bold text-[#1a1a1a]">{formatPartnerMonthlyAmount('lite')}</span>
                <span className="text-[#555] text-sm mb-2">CAD / month</span>
              </div>
              <p className="text-xs text-[#5D755D] font-medium mb-6">{PARTNER_TRIAL_LABEL_LONG}</p>
              <ul className="space-y-3 text-sm text-[#333] mb-8 flex-1">
                {[
                  'Up to 4 active workshops',
                  '0% commission on tickets',
                  'No Marketplace',
                  'No Shopify Sync',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-[#5D755D] mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/partners/signup"
                className="mt-auto block w-full rounded-full bg-[#5D755D] px-6 py-3 text-center text-sm font-semibold text-white hover:bg-[#4d634d] transition-colors"
              >
                Start free trial
              </Link>
            </div>
            <div className="rounded-3xl border-2 border-[#E8E6E0] bg-[#FAFAF8] p-8 shadow-sm flex flex-col h-full">
              <p className="text-sm font-semibold text-[#5D755D] uppercase tracking-wide mb-3">
                {SHOPIFY_SYNC_PLAN_NAME}
              </p>
              <div className="flex items-end gap-1 mb-1">
                <span className="font-playfair text-5xl font-bold text-[#1a1a1a]">
                  ${SHOPIFY_SYNC_MONTHLY_CAD}
                </span>
                <span className="text-[#555] text-sm mb-2">CAD / month</span>
              </div>
              <p className="text-xs text-[#5D755D] font-medium mb-6">{PARTNER_TRIAL_LABEL_LONG}</p>
              <ul className="space-y-3 text-sm text-[#333] mb-8 flex-1">
                {[
                  'Shopify Sync only',
                  'Guests book on Shopify',
                  'Billed via Shopify App Pricing',
                  'No Marketplace / no Lite workshops',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-[#5D755D] mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/partners/shopify-sync"
                className="mt-auto block w-full rounded-full border-2 border-[#5D755D] bg-transparent px-6 py-3 text-center text-sm font-semibold text-[#5D755D] hover:bg-[#EDF0ED] transition-colors"
              >
                Get started
              </Link>
            </div>
            <div className="rounded-3xl border-2 border-[#5D755D] bg-[#FAFAF8] p-8 shadow-sm flex flex-col h-full">
              <p className="text-sm font-semibold text-[#5D755D] uppercase tracking-wide mb-3">Pro</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="font-playfair text-5xl font-bold text-[#1a1a1a]">{formatPartnerMonthlyAmount('pro')}</span>
                <span className="text-[#555] text-sm mb-2">CAD / month</span>
              </div>
              <p className="text-xs text-[#5D755D] font-medium mb-6">{PARTNER_TRIAL_LABEL_LONG}</p>
              <ul className="space-y-3 text-sm text-[#333] mb-8 flex-1">
                {[
                  'Unlimited workshops',
                  'Artist Marketplace included',
                  '0% commission on tickets',
                  'No Shopify Sync (add Sync or Full)',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-[#5D755D] mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/partners/signup"
                className="mt-auto block w-full rounded-full bg-[#5D755D] px-6 py-3 text-center text-sm font-semibold text-white hover:bg-[#4d634d] transition-colors"
              >
                Start free trial
              </Link>
            </div>
            <div className="rounded-3xl border-2 border-[#5D755D] bg-[#EDF2ED] p-8 shadow-sm flex flex-col h-full sm:col-span-2 lg:col-span-1">
              <p className="text-sm font-semibold text-[#5D755D] uppercase tracking-wide mb-3">Full License</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="font-playfair text-5xl font-bold text-[#1a1a1a]">{formatPartnerMonthlyAmount('full')}</span>
                <span className="text-[#555] text-sm mb-2">CAD / month</span>
              </div>
              <p className="text-xs text-[#5D755D] font-medium mb-6">{PARTNER_TRIAL_LABEL_LONG}</p>
              <ul className="space-y-3 text-sm text-[#333] mb-8 flex-1">
                {[
                  'Everything in Pro',
                  'Marketplace included',
                  'Shopify Sync included (no extra Sync fee)',
                  'Best value if you use all three',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-[#5D755D] mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/partners/checkout?plan=full"
                className="mt-auto block w-full rounded-full bg-[#5D755D] px-6 py-3 text-center text-sm font-semibold text-white hover:bg-[#4d634d] transition-colors"
              >
                Start free trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Setup videos ────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <PartnerSetupVideos />
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="bg-white border-y border-[#E8E6E0] py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-playfair text-3xl font-bold text-center mb-12">
            Frequently asked questions
          </h2>
          <PartnerFaqAccordion />
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <h2 className="font-playfair text-4xl font-bold mb-4">
          Ready to fill your workshops?
        </h2>
        <p className="text-[#555] text-sm max-w-md mx-auto mb-10 leading-relaxed">
          Join offhrs Partners today. {PARTNER_TRIAL_LABEL}, then {formatPartnerPlansFromLine()}. No commission. Cancel anytime.
        </p>
        <Link
          href="/partners/signup"
          className="inline-block rounded-full bg-[#5D755D] px-10 py-4 text-sm font-semibold text-white hover:bg-[#4d634d] transition-colors shadow-md"
        >
          Start free {PARTNER_TRIAL_LABEL}
        </Link>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#E8E6E0] py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#999]">
          <span>© {new Date().getFullYear()} offhrs. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-[#555] transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-[#555] transition-colors">Privacy</Link>
            <a href="mailto:support@offhrs.app" className="hover:text-[#555] transition-colors">
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
