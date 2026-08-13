import type { Metadata } from 'next'
import Link from 'next/link'
import { OffhrsLogoLink } from '@/components/offhrs-logo'
import {
  PARTNER_TRIAL_LABEL,
  SHOPIFY_SYNC_MONTHLY_CAD,
  SHOPIFY_SYNC_PLAN_NAME,
} from '@/lib/partner-pricing'
import { getSiteUrl } from '@/lib/site'

const site = getSiteUrl()

export const metadata: Metadata = {
  title: `Shopify Sync — offhrs Partners`,
  description: `Set up ${SHOPIFY_SYNC_PLAN_NAME} ($${SHOPIFY_SYNC_MONTHLY_CAD} CAD/month): install the offhrs Shopify app, tag workshop products, and list them in the offhrs app while guests book on your store.`,
  alternates: { canonical: `${site}/partners/shopify-sync` },
  openGraph: {
    title: `${SHOPIFY_SYNC_PLAN_NAME} — offhrs Partners`,
    description: `Mirror tagged Shopify workshops into offhrs. Guests discover you in the app and book on your storefront. $${SHOPIFY_SYNC_MONTHLY_CAD} CAD/month with a ${PARTNER_TRIAL_LABEL}.`,
    url: `${site}/partners/shopify-sync`,
    siteName: 'offhrs',
    type: 'website',
    locale: 'en_CA',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'offhrs' }],
  },
}

const steps = [
  {
    n: '01',
    title: 'Create an offhrs partner account',
    body: 'Sign up with your studio details. You’ll need this account to claim the Shopify install and manage Sync in Settings.',
  },
  {
    n: '02',
    title: 'Install offhrs from Shopify',
    body: 'In Shopify Admin → Apps (or the Shopify App Store), install the offhrs app. Do not type a shop domain into offhrs — install must start from Shopify so OAuth can complete.',
  },
  {
    n: '03',
    title: 'Sign in and claim your shop',
    body: 'After install, you’ll be guided to sign in (or create your account) so the shop links to your partner profile. One Shopify shop per offhrs account.',
  },
  {
    n: '04',
    title: 'Start the Shopify Sync trial',
    body: `In Partners → Settings, choose Start trial for Shopify Sync ($${SHOPIFY_SYNC_MONTHLY_CAD} CAD/month, ${PARTNER_TRIAL_LABEL}). Approve the plan in Shopify Admin — billing is on your Shopify invoice, not Stripe.`,
  },
  {
    n: '05',
    title: 'Tag workshop products',
    body: (
      <>
        On each workshop product in Shopify, add the tag{' '}
        <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] font-medium text-[#1a1a1a]">
          offhrs_workshop
        </code>
        . Only tagged products are synced.
      </>
    ),
  },
  {
    n: '06',
    title: 'Give each session a date & time',
    body: (
      <>
        Each Shopify variant becomes one session on offhrs. Use a Date (or similar) option with a
        clear datetime — for example{' '}
        <span className="font-medium text-[#1a1a1a]">August 21, 2026 12:00 PM</span> — or set an{' '}
        <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] font-medium text-[#1a1a1a]">
          offhrs.starts_at
        </code>{' '}
        metafield. Times without a timezone are read as America/Toronto. Variants we can’t parse are
        skipped.
      </>
    ),
  },
  {
    n: '07',
    title: 'Sync and go live',
    body: 'Hit Sync now in Settings (webhooks keep products and inventory updated afterward). Guests see your workshops in the offhrs app and tap Book on Shopify to checkout on your store.',
  },
]

const canDo = [
  'List tagged Shopify workshops in the offhrs app for discovery',
  'Keep remaining seats in sync from Shopify inventory',
  'Send guests to your Shopify product page to book and pay',
  'Run Sync alone — no Lite or Pro plan required',
  'Use your partner profile address for map pins and studio location',
]

const cannotDo = [
  'Checkout or take payment inside offhrs for synced workshops (that stays on Shopify)',
  'Create or edit workshop sessions in the offhrs dashboard as the source of truth — edit products in Shopify',
  'Process refunds in offhrs for Shopify bookings — refund in Shopify Admin',
  'Replace Lite/Pro: Sync does not unlock native offhrs booking, Stripe Connect ticket sales, or in-app workshop creation',
  'Connect directly to third-party Shopify apps (for example Numos) — we only read products and inventory from Shopify itself',
]

export default function ShopifySyncGuidePage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1a1a1a]">
      <nav className="sticky top-0 z-50 bg-[#FAFAF8]/90 backdrop-blur border-b border-[#E8E6E0]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <OffhrsLogoLink href="/" priority className="h-9 w-auto max-w-[180px]" width={220} height={52} />
          <div className="flex items-center gap-4">
            <Link
              href="/partners"
              className="text-sm text-[#555] hover:text-[#1a1a1a] transition-colors"
            >
              Pricing
            </Link>
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
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      <header className="max-w-3xl mx-auto px-6 pt-16 pb-12 text-center">
        <p className="inline-block rounded-full bg-[#EDF0ED] px-4 py-1 text-xs font-semibold text-[#5D755D] mb-6 tracking-wide uppercase">
          {SHOPIFY_SYNC_PLAN_NAME} · ${SHOPIFY_SYNC_MONTHLY_CAD} CAD/month
        </p>
        <h1 className="font-playfair text-4xl md:text-5xl font-bold leading-tight tracking-tight">
          How Shopify Sync works
        </h1>
        <p className="mt-5 text-base text-[#555] leading-relaxed max-w-xl mx-auto">
          Keep Shopify as your booking system. We mirror tagged workshop products into the offhrs
          app so Toronto guests can discover you — then they complete booking on your storefront.
        </p>
      </header>

      <section className="bg-white border-y border-[#E8E6E0] py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-playfair text-2xl font-bold mb-8 text-center">What Sync can and can’t do</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-left">
            <div>
              <p className="text-sm font-semibold text-[#5D755D] uppercase tracking-wide mb-4">
                We can
              </p>
              <ul className="space-y-3 text-sm text-[#333]">
                {canDo.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-[#5D755D] mt-0.5 shrink-0">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#555] uppercase tracking-wide mb-4">
                We can’t
              </p>
              <ul className="space-y-3 text-sm text-[#333]">
                {cannotDo.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-[#999] mt-0.5 shrink-0">–</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-[#E8E6E0] bg-[#FAFAF8] p-6 text-sm text-[#555] leading-relaxed">
            <p className="font-semibold text-[#1a1a1a] mb-2">Third-party Shopify apps (e.g. Numos)</p>
            <p>
              offhrs Sync does not integrate with Numos or other external apps. If another app writes
              products, variants, dates, or inventory into Shopify, we can still sync that data —
              but only because it lives in Shopify. We won’t push availability, bookings, or catalog
              changes back into Numos (or similar tools). Treat Shopify as the shared source of
              truth between systems.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="font-playfair text-2xl font-bold mb-3 text-center">Setup checklist</h2>
        <p className="text-sm text-[#555] text-center mb-12 max-w-md mx-auto">
          Follow these steps once. After you’re live, keep tagging new workshops and editing dates
          in Shopify.
        </p>
        <ol className="space-y-8">
          {steps.map((step) => (
            <li key={step.n} className="flex gap-5 text-left">
              <span className="font-playfair text-2xl font-bold text-[#D9D7CF] shrink-0 w-10">
                {step.n}
              </span>
              <div>
                <h3 className="font-semibold text-[#1a1a1a] mb-1">{step.title}</h3>
                <p className="text-sm text-[#555] leading-relaxed">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-white border-y border-[#E8E6E0] py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-playfair text-2xl font-bold mb-8 text-center">Product tips</h2>
          <ul className="space-y-4 text-sm text-[#333] leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-[#5D755D] mt-0.5">✓</span>
              <span>
                <span className="font-medium text-[#1a1a1a]">One product, many times:</span> use
                variants for each session time under the same product title — they group as one card
                with time options in the app.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#5D755D] mt-0.5">✓</span>
              <span>
                <span className="font-medium text-[#1a1a1a]">Inventory = seats left.</span> When
                quantity hits zero (or the product isn’t Active), we mark the session fully booked.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#5D755D] mt-0.5">✓</span>
              <span>
                <span className="font-medium text-[#1a1a1a]">Category</span> defaults to your{' '}
                <span className="font-medium text-[#1a1a1a]">primary signup category</span> (the
                first one you picked). Override per product with optional metafield{' '}
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px]">offhrs.category</code>
                .
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#5D755D] mt-0.5">✓</span>
              <span>
                <span className="font-medium text-[#1a1a1a]">Optional metafields</span> (namespace{' '}
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px]">offhrs</code>):{' '}
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px]">starts_at</code>,{' '}
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px]">book_url</code>,{' '}
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px]">capacity</code>,{' '}
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px]">duration_minutes</code>
                , <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px]">category</code>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#5D755D] mt-0.5">✓</span>
              <span>
                <span className="font-medium text-[#1a1a1a]">Studio address</span> comes from your
                offhrs partner profile (not the Shopify product) — keep that up to date for map pins.
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="font-playfair text-2xl font-bold mb-3 text-center">Date &amp; time formats</h2>
        <p className="text-sm text-[#555] text-center mb-10 max-w-lg mx-auto leading-relaxed">
          Each variant needs a parseable <span className="font-medium text-[#1a1a1a]">date and time</span>.
          Date-only values are skipped — we never invent a start time. Times without a timezone are
          read as America/Toronto.
        </p>

        <div className="space-y-8 text-left text-sm text-[#333] leading-relaxed">
          <div>
            <p className="font-semibold text-[#1a1a1a] mb-2">Recommended</p>
            <ul className="space-y-1.5 text-[#555]">
              <li>
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] text-[#1a1a1a]">
                  August 21, 2026 12:00 PM
                </code>
              </li>
              <li>
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] text-[#1a1a1a]">
                  Aug 21, 2026 12:00 PM
                </code>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-[#1a1a1a] mb-2">Also accepted</p>
            <ul className="space-y-1.5 text-[#555]">
              <li>
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] text-[#1a1a1a]">
                  August 21 2026 12:00 PM
                </code>
                {' / '}
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] text-[#1a1a1a]">
                  Aug 21 2026 12:00 PM
                </code>
              </li>
              <li>
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] text-[#1a1a1a]">
                  2026-08-21 12:00 PM
                </code>
                {' / '}
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] text-[#1a1a1a]">
                  2026-08-21 12:00
                </code>
                {' / '}
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] text-[#1a1a1a]">
                  2026-08-21T12:00
                </code>
              </li>
              <li>
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] text-[#1a1a1a]">
                  8/21/2026 12:00 PM
                </code>
                {' / '}
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] text-[#1a1a1a]">
                  8/21/2026 12:00
                </code>
              </li>
              <li>
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] text-[#1a1a1a]">
                  21 August 2026 12:00 PM
                </code>
                {' / '}
                <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] text-[#1a1a1a]">
                  21 Aug 2026 12:00 PM
                </code>
              </li>
              <li>ISO strings with a timezone offset or <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] text-[#1a1a1a]">Z</code> (parsed as real instants)</li>
            </ul>
            <p className="mt-3 text-[#555]">
              Ordinals (<code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] text-[#1a1a1a]">21st</code>) and{' '}
              <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] text-[#1a1a1a]">at</code>{' '}
              are fine — e.g.{' '}
              <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px] text-[#1a1a1a]">
                August 21, 2026 at 12:00 PM
              </code>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white border-y border-[#E8E6E0] py-20 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-playfair text-3xl font-bold mb-4">Ready to connect Shopify?</h2>
          <p className="text-sm text-[#555] max-w-md mx-auto mb-8 leading-relaxed">
            Create your partner account, then install offhrs from Shopify Admin and start the Sync
            trial in Settings.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/partners/signup"
              className="rounded-full bg-[#5D755D] px-8 py-3.5 text-sm font-semibold text-white hover:bg-[#4d634d] transition-colors shadow-sm"
            >
              Create partner account
            </Link>
            <Link
              href="/partners"
              className="rounded-full border border-[#D9D7CF] px-8 py-3.5 text-sm font-semibold text-[#1a1a1a] hover:bg-[#F0EDE8] transition-colors"
            >
              Back to pricing
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#E8E6E0] py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#999]">
          <span>© {new Date().getFullYear()} offhrs. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-[#555] transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-[#555] transition-colors">
              Privacy
            </Link>
            <a href="mailto:support@offhrs.app" className="hover:text-[#555] transition-colors">
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
