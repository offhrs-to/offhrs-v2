import type { Metadata } from 'next'
import Link from 'next/link'
import { OffhrsLogoLink } from '@/components/offhrs-logo'
import { getSiteUrl } from '@/lib/site'

const site = getSiteUrl()

export const metadata: Metadata = {
  title: 'offhrs Partners — Run your workshop business the easy way',
  description:
    'offhrs Partners gives Toronto workshop vendors instant booking, Stripe payouts, and Google/Outlook calendar sync — for $79 CAD/month. Start your free 7-day trial.',
  alternates: { canonical: `${site}/partners` },
  openGraph: {
    title: 'offhrs Partners — Run your workshop business the easy way',
    description:
      'All-in-one booking, payouts, and two-way calendar sync for creative workshop vendors in Toronto.',
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

const faqs = [
  {
    q: 'What happens after my 7-day trial?',
    a: 'Your account automatically moves to the $79 CAD/month plan on Day 8. You can cancel anytime before then with no charge.',
  },
  {
    q: 'Does offhrs take a commission on my bookings?',
    a: 'No. offhrs takes 0% commission. You receive 100% of ticket revenue minus Stripe processing fees (2.9% + $0.30 CAD).',
  },
  {
    q: 'How do payouts work?',
    a: 'Payments go directly from attendees to your Stripe Express account. Payouts arrive in your bank within 2 business days.',
  },
  {
    q: 'Which calendar apps are supported?',
    a: 'Google Calendar and Microsoft Outlook. Connect once and all bookings sync automatically in both directions.',
  },
  {
    q: 'Can I cancel my subscription?',
    a: 'Yes, anytime from your dashboard settings. You keep access until the end of your current billing period.',
  },
  {
    q: 'What types of workshops can I list?',
    a: 'Pottery, floral arranging, culinary classes, and more. If you teach a hands-on creative skill in Toronto, offhrs is built for you.',
  },
]

export default function PartnersLandingPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'offhrs Partners',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description:
          'SaaS booking engine for workshop vendors: instant booking, Stripe Connect payouts, and Cal.com calendar sync.',
        url: `${site}/partners`,
        offers: {
          '@type': 'Offer',
          price: '79',
          priceCurrency: 'CAD',
          description: 'Standard plan — monthly after 7-day free trial',
        },
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
          Bookings, payouts, and calendar sync — handled for you. Start your free 7-day trial for{' '}
          <span className="font-semibold text-[#1a1a1a]">$79 CAD/month</span> after.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/partners/signup"
            className="rounded-full bg-[#5D755D] px-8 py-3.5 text-sm font-semibold text-white hover:bg-[#4d634d] transition-colors shadow-sm"
          >
            Start free 7-day trial
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
              { step: '01', title: 'Sign up', body: 'Create your account and start your free 7-day trial. No upfront payment needed.' },
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
          <p className="text-[#555] text-sm mb-12 max-w-md mx-auto">
            One plan. No hidden fees. Zero commission on your sales.
          </p>
          <div className="inline-block rounded-3xl border-2 border-[#5D755D] bg-[#FAFAF8] p-10 text-left max-w-sm w-full shadow-sm">
            <p className="text-sm font-semibold text-[#5D755D] uppercase tracking-wide mb-4">
              Standard
            </p>
            <div className="flex items-end gap-1 mb-1">
              <span className="font-playfair text-5xl font-bold text-[#1a1a1a]">$79</span>
              <span className="text-[#555] text-sm mb-2">CAD / month</span>
            </div>
            <p className="text-xs text-[#5D755D] font-medium mb-6">7-day free trial included</p>
            <ul className="space-y-3 text-sm text-[#333] mb-8">
              {[
                'Unlimited workshop sessions',
                '0% commission on ticket sales',
                'Stripe Connect payouts',
                'Google & Outlook calendar sync',
                'Stripe-powered secure checkout',
                'Fully booked management',
                'Revenue dashboard',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-[#5D755D] mt-0.5">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/partners/signup"
              className="block w-full rounded-full bg-[#5D755D] px-6 py-3 text-center text-sm font-semibold text-white hover:bg-[#4d634d] transition-colors"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="bg-white border-y border-[#E8E6E0] py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-playfair text-3xl font-bold text-center mb-12">
            Frequently asked questions
          </h2>
          <div className="space-y-8">
            {faqs.map((faq) => (
              <div key={faq.q} className="border-b border-[#E8E6E0] pb-8 last:border-0 last:pb-0">
                <h3 className="font-semibold text-[#1a1a1a] mb-2">{faq.q}</h3>
                <p className="text-sm text-[#555] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <h2 className="font-playfair text-4xl font-bold mb-4">
          Ready to fill your workshops?
        </h2>
        <p className="text-[#555] text-sm max-w-md mx-auto mb-10 leading-relaxed">
          Join offhrs Partners today. 7 days free, then $79 CAD/month. No commission. Cancel anytime.
        </p>
        <Link
          href="/partners/signup"
          className="inline-block rounded-full bg-[#5D755D] px-10 py-4 text-sm font-semibold text-white hover:bg-[#4d634d] transition-colors shadow-md"
        >
          Start free 7-day trial
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
