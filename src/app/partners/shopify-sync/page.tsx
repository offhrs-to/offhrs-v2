import type { Metadata } from 'next'
import Link from 'next/link'
import { FloatingNav, navPillSignIn } from '@/components/marketing/floating-nav'
import { MarketingSiteFooter } from '@/components/marketing/site-footer'
import { IconCheck } from '@/components/marketing/doodle-icons'
import {
  PARTNER_TRIAL_LABEL,
  SHOPIFY_SYNC_MONTHLY_CAD,
  SHOPIFY_SYNC_PLAN_NAME,
} from '@/lib/partner-pricing'
import { getSiteUrl } from '@/lib/site'

const site = getSiteUrl()

export const metadata: Metadata = {
  title: `Shopify Sync — offhrs Partners`,
  description: `Set up ${SHOPIFY_SYNC_PLAN_NAME} ($${SHOPIFY_SYNC_MONTHLY_CAD} CAD/month): install the offhrs sales channel, publish workshop products to offhrs, and let guests book on Shopify checkout.`,
  alternates: { canonical: `${site}/partners/shopify-sync` },
  openGraph: {
    title: `${SHOPIFY_SYNC_PLAN_NAME} — offhrs Partners`,
    description: `Publish workshop products from Shopify Admin to the offhrs sales channel. Guests discover you in the app and book on Shopify checkout. $${SHOPIFY_SYNC_MONTHLY_CAD} CAD/month with a ${PARTNER_TRIAL_LABEL}.`,
    url: `${site}/partners/shopify-sync`,
    siteName: 'offhrs',
    type: 'website',
    locale: 'en_CA',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'offhrs' }],
  },
}

const codeChip = 'rounded-lg bg-[#EDF2ED] px-1.5 py-0.5 text-[13px] font-medium text-neutral-900'

const steps = [
  {
    n: '01',
    title: 'Create an offhrs partner account',
    body: 'Sign up with your studio details. You’ll use this account to connect the Shopify install under Sales channels → offhrs.',
  },
  {
    n: '02',
    title: 'Install offhrs from Shopify',
    body: 'In Shopify Admin → Apps (or the Shopify App Store), install the offhrs app. It appears under Sales channels → offhrs. Do not type a shop domain into offhrs — install must start from Shopify so OAuth can complete.',
  },
  {
    n: '03',
    title: 'Connect your partner account',
    body: 'Open Sales channels → offhrs and use Connect to sign in (or create your account) so the shop links to your partner profile. One Shopify shop per offhrs account.',
  },
  {
    n: '04',
    title: 'Start the Shopify Sync trial',
    body: `In Sales channels → offhrs, choose Start trial for Shopify Sync ($${SHOPIFY_SYNC_MONTHLY_CAD} CAD/month, ${PARTNER_TRIAL_LABEL}). Approve the plan in Shopify Admin. Billing runs through Shopify Billing on your Shopify invoice — not Stripe.`,
  },
  {
    n: '05',
    title: 'Publish workshop products to offhrs',
    body: (
      <>
        On each workshop product in Shopify Admin, open{' '}
        <span className="font-medium text-neutral-900">Publishing</span> and enable the{' '}
        <span className="font-medium text-neutral-900">offhrs</span> sales channel (not only Online
        Store). Unpublishing from offhrs removes the listing from the app.
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
        <span className="font-medium text-neutral-900">August 21, 2026 12:00 PM</span> — or set an{' '}
        <code className={codeChip}>offhrs.starts_at</code> metafield. Times without a timezone are
        read as America/Toronto. Variants we can’t parse are skipped (and show as product feedback in
        Admin).
      </>
    ),
  },
  {
    n: '07',
    title: 'Sync and go live',
    body: 'In Sales channels → offhrs, tap Sync published products (feeds keep products and inventory updated afterward). Guests see your workshops in the offhrs app and tap Book on Shopify to open a cart permalink and checkout on your store.',
  },
]

const canDo = [
  'Publish Shopify workshop products to the offhrs app for local discovery',
  'Keep remaining seats in sync from Shopify inventory',
  'Send guests to Shopify checkout with the session pre-loaded in cart',
  'Run Sync alone — billed through Shopify Billing on your Shopify invoice',
  'Use your partner profile address for map pins and studio location',
]

const cannotDo = [
  'Checkout or take payment inside offhrs for synced workshops (that stays on Shopify)',
  'Create or edit workshop sessions in the offhrs dashboard as the source of truth — edit and publish products in Shopify',
  'Process refunds in offhrs for Shopify bookings — refund in Shopify Admin',
  'Charge a commission on workshop orders checked out on Shopify',
  'Connect directly to third-party Shopify apps (for example Numos) — we only read products and inventory from Shopify itself',
]

export default async function ShopifySyncGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>
}) {
  const { onboarding } = await searchParams
  const afterSignup = onboarding === '1'

  return (
    <div className="relative min-h-screen bg-[#F7F5F1] text-neutral-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 overflow-hidden"
      >
        <div className="absolute -left-16 top-0 h-44 w-44 rounded-full bg-[#D9D2C5]/55 blur-3xl" />
        <div className="absolute right-10 top-4 h-40 w-56 rounded-full bg-[#C9D0C4]/45 blur-3xl" />
        <div className="absolute left-1/3 top-8 h-32 w-48 rounded-full bg-[#E8DFD2]/50 blur-3xl" />
      </div>

      <FloatingNav
        trailing={
          <Link href="/partners/login" className={`hidden sm:inline-flex ${navPillSignIn}`}>
            Sign in
          </Link>
        }
      />

      {afterSignup && (
        <div className="relative border-b border-heading-dark/20 bg-[#EDF2ED] pt-20">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-relaxed text-neutral-900">
              Account ready — install offhrs from Shopify Admin, then open{' '}
              <span className="font-medium">Sales channels → offhrs</span> to connect and start the
              Sync trial.
            </p>
            <Link
              href="/partners/dashboard/settings"
              className="shrink-0 rounded-full bg-heading-dark px-5 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-heading-dark/90"
            >
              Partner dashboard
            </Link>
          </div>
        </div>
      )}

      <header className={`relative mx-auto max-w-3xl px-5 pb-10 text-center sm:px-6 sm:pb-12 ${afterSignup ? 'pt-10 sm:pt-12' : 'pt-24 sm:pt-28 md:pt-36'}`}>
        <p className="mb-5 inline-block rounded-full bg-[#EDF2ED] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-heading-dark sm:mb-6 sm:px-4 sm:text-xs">
          {SHOPIFY_SYNC_PLAN_NAME} · ${SHOPIFY_SYNC_MONTHLY_CAD} CAD/month
        </p>
        <h1 className="text-[1.85rem] font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
          How Shopify Sync works
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-neutral-600 sm:mt-5 sm:text-base">
          Keep Shopify as your booking system. Publish workshop products to the offhrs sales channel
          so Canada (CAD) guests can discover you — then they complete booking on Shopify checkout.
        </p>
      </header>

      <section className="relative border-y border-neutral-200/80 bg-white py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold tracking-tight sm:text-3xl">
            What Sync can and can’t do
          </h2>
          <div className="grid grid-cols-1 gap-8 text-left sm:grid-cols-2">
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-heading-dark">
                We can
              </p>
              <ul className="space-y-3 text-sm text-neutral-700">
                {canDo.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-heading-dark" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                We can’t
              </p>
              <ul className="space-y-3 text-sm text-neutral-700">
                {cannotDo.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 text-neutral-400">–</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-neutral-200 bg-[#F7F5F1] p-6 text-sm leading-relaxed text-neutral-600">
            <p className="mb-2 font-semibold text-neutral-900">Third-party Shopify apps (e.g. Numos)</p>
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

      <section className="relative mx-auto max-w-3xl px-6 py-16">
        <h2 className="mb-3 text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Setup checklist
        </h2>
        <p className="mx-auto mb-12 max-w-md text-center text-sm text-neutral-500">
          Follow these steps once. After you’re live, publish new workshops to offhrs and edit dates
          in Shopify Admin.
        </p>
        <ol className="space-y-8">
          {steps.map((step) => (
            <li key={step.n} className="flex gap-5 text-left">
              <span className="w-10 shrink-0 text-2xl font-bold text-neutral-300">{step.n}</span>
              <div>
                <h3 className="mb-1 font-semibold text-neutral-900">{step.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="relative border-y border-neutral-200/80 bg-white py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Product tips
          </h2>
          <ul className="space-y-4 text-sm leading-relaxed text-neutral-700">
            <li className="flex items-start gap-2">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-heading-dark" />
              <span>
                <span className="font-medium text-neutral-900">One product, many times:</span> use
                variants for each session time under the same product title — they group as one card
                with time options in the app.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-heading-dark" />
              <span>
                <span className="font-medium text-neutral-900">Inventory = seats left.</span> When
                quantity hits zero (or the product isn’t Active), we mark the session fully booked.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-heading-dark" />
              <span>
                <span className="font-medium text-neutral-900">Category</span> defaults to your{' '}
                <span className="font-medium text-neutral-900">primary signup category</span> (the
                first one you picked). Override per product with optional metafield{' '}
                <code className={codeChip}>offhrs.category</code>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-heading-dark" />
              <span>
                <span className="font-medium text-neutral-900">Optional metafields</span> (namespace{' '}
                <code className={codeChip}>offhrs</code>): <code className={codeChip}>starts_at</code>,{' '}
                <code className={codeChip}>book_url</code> (same-shop Shopify cart or checkout only —
                the storefront token and channel source are added; otherwise the generated cart link
                is used), <code className={codeChip}>capacity</code>,{' '}
                <code className={codeChip}>duration_minutes</code>,{' '}
                <code className={codeChip}>category</code>. Book CTAs use a Shopify cart permalink
                with channel attribution by default.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-heading-dark" />
              <span>
                <span className="font-medium text-neutral-900">Studio address</span> comes from your
                offhrs partner profile (not the Shopify product) — keep that up to date for map pins.
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section className="relative mx-auto max-w-3xl px-6 py-16">
        <h2 className="mb-3 text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Date &amp; time formats
        </h2>
        <p className="mx-auto mb-10 max-w-lg text-center text-sm leading-relaxed text-neutral-500">
          Each variant needs a parseable <span className="font-medium text-neutral-900">date and time</span>.
          Date-only values are skipped — we never invent a start time. Times without a timezone are
          read as America/Toronto.
        </p>

        <div className="space-y-8 text-left text-sm leading-relaxed text-neutral-700">
          <div>
            <p className="mb-2 font-semibold text-neutral-900">Recommended</p>
            <ul className="space-y-1.5 text-neutral-600">
              <li>
                <code className={codeChip}>August 21, 2026 12:00 PM</code>
              </li>
              <li>
                <code className={codeChip}>Aug 21, 2026 12:00 PM</code>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-2 font-semibold text-neutral-900">Also accepted</p>
            <ul className="space-y-1.5 text-neutral-600">
              <li>
                <code className={codeChip}>August 21 2026 12:00 PM</code>
                {' / '}
                <code className={codeChip}>Aug 21 2026 12:00 PM</code>
              </li>
              <li>
                <code className={codeChip}>2026-08-21 12:00 PM</code>
                {' / '}
                <code className={codeChip}>2026-08-21 12:00</code>
                {' / '}
                <code className={codeChip}>2026-08-21T12:00</code>
              </li>
              <li>
                <code className={codeChip}>8/21/2026 12:00 PM</code>
                {' / '}
                <code className={codeChip}>8/21/2026 12:00</code>
              </li>
              <li>
                <code className={codeChip}>21 August 2026 12:00 PM</code>
                {' / '}
                <code className={codeChip}>21 Aug 2026 12:00 PM</code>
              </li>
              <li>
                ISO strings with a timezone offset or <code className={codeChip}>Z</code> (parsed as
                real instants)
              </li>
            </ul>
            <p className="mt-3 text-neutral-600">
              Ordinals (<code className={codeChip}>21st</code>) and{' '}
              <code className={codeChip}>at</code> are fine — e.g.{' '}
              <code className={codeChip}>August 21, 2026 at 12:00 PM</code>.
            </p>
          </div>
        </div>
      </section>

      <section className="relative border-y border-neutral-200/80 bg-white py-20 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-4 text-3xl font-bold tracking-tight">
            {afterSignup ? 'Next: install from Shopify' : 'Ready to connect Shopify?'}
          </h2>
          <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-neutral-500">
            {afterSignup
              ? 'Install the offhrs app from Shopify Admin, then open Sales channels → offhrs to connect and start the Sync trial. Billing runs through Shopify Billing on your Shopify invoice.'
              : 'Create your partner account, continue with Shopify Sync, then install offhrs from Shopify Admin and manage Sync under Sales channels → offhrs.'}
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            {afterSignup ? (
              <Link
                href="/partners/dashboard/settings"
                className="rounded-full bg-heading-dark px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-heading-dark/90"
              >
                Partner dashboard
              </Link>
            ) : (
              <Link
                href="/partners/signup?intent=shopify_sync"
                className="rounded-full bg-heading-dark px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-heading-dark/90"
              >
                Create partner account
              </Link>
            )}
            <Link
              href="/partners"
              className="rounded-full border border-neutral-300 px-8 py-3.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-[#F0EDE8]"
            >
              Back to pricing
            </Link>
          </div>
        </div>
      </section>

      <MarketingSiteFooter showStoreBadges />
    </div>
  )
}
