import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  FloatingNav,
  navPillSignIn,
  navPillCta,
} from '@/components/marketing/floating-nav'
import { MarketingSiteFooter } from '@/components/marketing/site-footer'
import { ExpandableSection } from '@/components/marketing/expandable-section'
import { PartnerFaqAccordion } from '@/components/partners/PartnerFaqAccordion'
import {
  IconBookPay,
  IconBrowse,
  IconCheck,
  IconCollection,
  IconCommunity,
  IconCrossPollinate,
  IconDashboard,
  IconDiscover,
  IconHost,
  IconListArt,
  IconListWorkshop,
  IconShipPickup,
  IconShopifyCheckout,
  IconShopifyConnect,
  IconShopifyInstall,
  IconShopifyPublish,
} from '@/components/marketing/doodle-icons'
import {
  formatPartnerMonthlyAmount,
  formatPartnerPlansFromLine,
  PARTNER_PLAN_MONTHLY_CAD,
  PARTNER_TRIAL_LABEL,
  PARTNER_TRIAL_LABEL_LONG,
  SHOPIFY_SYNC_MONTHLY_CAD,
  SHOPIFY_SYNC_PLAN_NAME,
} from '@/lib/partner-pricing'
import { isPartnerSignupShopifySyncOnly } from '@/lib/partner-signup-plans'
import { flattenPartnerFaqs } from '@/lib/partner-faq'
import { getSiteUrl } from '@/lib/site'

const site = getSiteUrl()

export const metadata: Metadata = {
  title: 'offhrs Partners — Teach what you love, sell what you make',
  description: `offhrs Partners: Marketplace free; Lite $${PARTNER_PLAN_MONTHLY_CAD.lite}; Shopify Sync $${SHOPIFY_SYNC_MONTHLY_CAD}; Pro $${PARTNER_PLAN_MONTHLY_CAD.pro} CAD/month. Start your free ${PARTNER_TRIAL_LABEL}.`,
  alternates: { canonical: `${site}/partners` },
  openGraph: {
    title: 'offhrs Partners — workshops, Marketplace & Shopify Sync',
    description: `Marketplace free · Lite $${PARTNER_PLAN_MONTHLY_CAD.lite} · Sync $${SHOPIFY_SYNC_MONTHLY_CAD} · Pro $${PARTNER_PLAN_MONTHLY_CAD.pro}/mo after a ${PARTNER_TRIAL_LABEL}.`,
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

const WHY_POINTS = [
  {
    icon: IconCommunity,
    title: 'Build a creative community around you',
    body: 'offhrs connects you with locals who already care about making things by hand — potters meeting florists, coffee nerds trying ceramics. Your studio becomes part of a shared creative scene, not a one-off booking link.',
  },
  {
    icon: IconCrossPollinate,
    title: 'Reach mutually curious art lovers',
    body: 'People browsing pottery often explore floral, culinary, and scent workshops next. Curated discovery puts your work in front of adjacent passions — new guests who already love local art.',
  },
  {
    icon: IconDashboard,
    title: 'Easy setup. A dashboard that stays calm.',
    body: 'List workshops, sync calendars, take Stripe payouts, manage capacity, and track revenue from one clean backend. Optional Shopify Sync keeps your existing checkout if that’s how you sell.',
  },
]

const FEATURES = [
  'Instant booking & payment',
  '0% commission on workshop tickets',
  'Stripe payouts to your bank',
  'Google & Outlook calendar sync',
  'Secure Stripe checkout',
  'Capacity & fully-booked handling',
  'Revenue dashboard',
  'Artist Marketplace (Pro)',
  'Shopify Sync (optional)',
]

const WORKSHOP_HOW = [
  {
    n: '01',
    icon: IconListWorkshop,
    text: 'Create your workshop listing — dates, capacity, price, and photos — in minutes.',
  },
  {
    n: '02',
    icon: IconDiscover,
    text: 'offhrs surfaces it to locals exploring pottery, floral, culinary, and more.',
  },
  {
    n: '03',
    icon: IconBookPay,
    text: 'Guests book and pay in the app (or on Shopify if you use Sync).',
  },
  {
    n: '04',
    icon: IconHost,
    text: 'You host. Attendance, capacity, and payouts stay tidy in your dashboard.',
  },
]

const SHOPIFY_SYNC_HOW = [
  {
    n: '01',
    icon: IconShopifyInstall,
    text: 'Install the offhrs app from Shopify Admin — it appears under Sales channels → offhrs.',
  },
  {
    n: '02',
    icon: IconShopifyConnect,
    text: 'Connect your partner account and start the Shopify Sync trial in Sales channels → offhrs.',
  },
  {
    n: '03',
    icon: IconShopifyPublish,
    text: 'Publish workshop products to the offhrs channel and give each session a clear date & time.',
  },
  {
    n: '04',
    icon: IconShopifyCheckout,
    text: 'Guests discover you in the app, then complete booking on your Shopify checkout.',
  },
]

const MARKETPLACE_HOW = [
  {
    n: '01',
    icon: IconListArt,
    text: 'Upload your artworks with photos, price, and shipping or pickup options.',
  },
  {
    n: '02',
    icon: IconBrowse,
    text: 'Shoppers browse curated local art alongside workshops they already love.',
  },
  {
    n: '03',
    icon: IconShipPickup,
    text: 'They buy on offhrs — ship Canada-wide or arrange pickup with you.',
  },
  {
    n: '04',
    icon: IconCollection,
    text: 'You fulfill the order and get paid. They keep building a collection that feels local.',
  },
]

function HowRow({
  title,
  subtitle,
  steps,
  tone,
}: {
  title: string
  subtitle: string
  steps: typeof WORKSHOP_HOW
  tone: 'cream' | 'white'
}) {
  return (
    <section className={tone === 'cream' ? 'bg-[#F7F5F1]' : 'bg-white'}>
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20 md:py-24">
        <h2 className="text-center text-[1.65rem] font-bold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-lg px-2 text-center text-sm text-neutral-500 sm:text-base">
          {subtitle}
        </p>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <div
                key={step.n}
                className="flex flex-col items-center rounded-2xl border border-neutral-200/80 bg-white px-5 py-8 text-center shadow-sm"
              >
                <p className="text-sm font-medium text-neutral-400">{step.n}</p>
                <Icon className="mt-4 h-11 w-11 text-neutral-900" />
                <p className="mt-5 text-sm font-semibold leading-snug text-neutral-900 sm:text-[15px]">
                  {step.text}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default function PartnersLandingPage() {
  const syncOnlySignup = isPartnerSignupShopifySyncOnly()
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
          },
          {
            '@type': 'Offer',
            name: 'Lite',
            price: String(PARTNER_PLAN_MONTHLY_CAD.lite),
            priceCurrency: 'CAD',
          },
          {
            '@type': 'Offer',
            name: SHOPIFY_SYNC_PLAN_NAME,
            price: String(SHOPIFY_SYNC_MONTHLY_CAD),
            priceCurrency: 'CAD',
          },
          {
            '@type': 'Offer',
            name: 'Pro',
            price: String(PARTNER_PLAN_MONTHLY_CAD.pro),
            priceCurrency: 'CAD',
          },
        ],
        publisher: { '@type': 'Organization', name: 'offhrs', url: site },
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
    <div className="bg-white text-neutral-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <FloatingNav
        trailing={
          <>
            <Link href="/partners/login" className={`hidden sm:inline-flex ${navPillSignIn}`}>
              Sign in
            </Link>
            {!syncOnlySignup ? (
              <Link href="/partners/signup" className={navPillCta}>
                Start free trial
              </Link>
            ) : null}
          </>
        }
      />

      {/* Hero — portrait mobile asset fills the phone; landscape cover on desktop */}
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-[#F5F2ED]">
        <h1 className="sr-only">
          offhrs Partners — Teach what you love, sell what you make
        </h1>
        <div className="absolute inset-0 md:hidden">
          <Image
            src="/landing/partners-hero-mobile.png"
            alt="offhrs Partners — Teach what you love, sell what you make"
            fill
            priority
            quality={95}
            className="object-cover object-center"
            sizes="100vw"
          />
        </div>
        <div className="absolute inset-0 hidden md:block">
          <Image
            src="/landing/partners-hero.png"
            alt="offhrs Partners — Teach what you love, sell what you make"
            fill
            priority
            quality={95}
            className="object-cover object-center"
            sizes="100vw"
          />
        </div>
      </section>

      {/* Why */}
      <section className="bg-[#F7F5F1]">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20 md:py-24">
          <h2 className="text-center text-[1.65rem] font-bold tracking-tight sm:text-3xl md:text-4xl">
            Why local businesses partner with offhrs
          </h2>
          <div className="mt-10 grid grid-cols-1 items-start gap-10 sm:mt-14 sm:gap-12 md:grid-cols-3 md:gap-10">
            {WHY_POINTS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex h-full flex-col items-center text-center">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center">
                  <Icon className="h-12 w-12 text-neutral-900" />
                </div>
                <h3 className="mt-5 flex min-h-[3.5rem] items-start justify-center text-lg font-bold leading-snug">
                  {title}
                </h3>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-600 sm:text-[15px]">
                  {body}
                </p>
              </div>
            ))}
          </div>

          <ExpandableSection label="Everything you need" className="mx-auto mt-16 max-w-3xl">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FEATURES.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2.5 rounded-full bg-white/80 px-4 py-2.5 text-sm text-neutral-800"
                >
                  <IconCheck className="h-5 w-5 shrink-0 text-heading-dark" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </ExpandableSection>
        </div>
      </section>

      <HowRow
        title="How offhrs workshop discovery works"
        subtitle="Simple for your guests. Simple for you."
        steps={WORKSHOP_HOW}
        tone="white"
      />
      <HowRow
        title="How Shopify Sync works"
        subtitle="Keep Shopify as checkout. Let offhrs handle discovery."
        steps={SHOPIFY_SYNC_HOW}
        tone="cream"
      />
      <HowRow
        title="How offhrs Artist Marketplace works"
        subtitle="List once. Reach collectors who already love local makers."
        steps={MARKETPLACE_HOW}
        tone="white"
      />

      {/* Pricing — simpler tamp-style cards */}
      <section className="bg-[#F7F5F1]">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:px-6 sm:py-20 md:py-24">
          <h2 className="text-center text-[1.65rem] font-bold tracking-tight sm:text-3xl md:text-4xl">
            Pricing
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-neutral-500">
            {syncOnlySignup ? (
              <>
                {SHOPIFY_SYNC_PLAN_NAME} is ${SHOPIFY_SYNC_MONTHLY_CAD} CAD/month after a{' '}
                {PARTNER_TRIAL_LABEL}, billed through Shopify Billing.
              </>
            ) : (
              <>
                Marketplace Only is free. Lite and Pro run bookings on offhrs. Shopify Sync bills in
                Shopify. Paid plans include a {PARTNER_TRIAL_LABEL}.
              </>
            )}
          </p>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Marketplace Only */}
            <div className="rounded-3xl bg-white p-8 opacity-70 shadow-sm">
              <p className="font-semibold italic text-neutral-800">Marketplace Only</p>
              <p className="mt-3 text-4xl font-bold">$0</p>
              <p className="mt-1 text-sm text-neutral-500">to join · 3% + Stripe on sales</p>
              <span className="mt-4 inline-flex rounded-full bg-[#EDF2ED] px-3 py-1 text-xs font-semibold text-heading-dark">
                Coming soon
              </span>
              <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Includes
              </p>
              <ul className="mt-3 space-y-2.5 text-sm text-neutral-700">
                {['Sell physical goods Canada-wide', 'No workshops dashboard', 'No Shopify Sync'].map(
                  (item) => (
                    <li key={item} className="flex items-start gap-2">
                      <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                      {item}
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Lite */}
            <div
              className={`rounded-3xl bg-white p-8 shadow-sm ${syncOnlySignup ? 'opacity-60' : ''}`}
            >
              <p className="font-semibold italic text-neutral-800">Lite</p>
              <p className="mt-3 text-4xl font-bold">{formatPartnerMonthlyAmount('lite')}</p>
              <p className="mt-1 text-sm text-neutral-500">CAD / month</p>
              <span className="mt-4 inline-flex rounded-full bg-[#EDF2ED] px-3 py-1 text-xs font-semibold text-heading-dark">
                {PARTNER_TRIAL_LABEL_LONG}
              </span>
              <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Includes
              </p>
              <ul className="mt-3 space-y-2.5 text-sm text-neutral-700">
                {[
                  'Up to 4 active workshops',
                  '0% commission on tickets',
                  'No Marketplace',
                  'No Shopify Sync',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-heading-dark" />
                    {item}
                  </li>
                ))}
              </ul>
              {!syncOnlySignup ? (
                <Link
                  href="/partners/signup"
                  className="mt-8 inline-flex rounded-full bg-heading-dark px-6 py-2.5 text-sm font-semibold text-white hover:bg-heading-dark/90"
                >
                  Start free trial
                </Link>
              ) : (
                <p className="mt-8 text-sm font-semibold text-neutral-400">Coming soon</p>
              )}
            </div>

            {/* Shopify Sync */}
            <div
              className={`rounded-3xl bg-white p-8 shadow-sm ${syncOnlySignup ? 'ring-2 ring-heading-dark' : 'opacity-60'}`}
            >
              <p className="font-semibold italic text-neutral-800">{SHOPIFY_SYNC_PLAN_NAME}</p>
              <p className="mt-3 text-4xl font-bold">${SHOPIFY_SYNC_MONTHLY_CAD}</p>
              <p className="mt-1 text-sm text-neutral-500">CAD / month · billed in Shopify</p>
              <span className="mt-4 inline-flex rounded-full bg-[#EDF2ED] px-3 py-1 text-xs font-semibold text-heading-dark">
                {PARTNER_TRIAL_LABEL_LONG}
              </span>
              <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Includes
              </p>
              <ul className="mt-3 space-y-2.5 text-sm text-neutral-700">
                {[
                  'Shopify Sync only',
                  'Guests book on Shopify',
                  'Billed via Shopify Billing',
                  'No Marketplace / no Lite workshops',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <IconCheck
                      className={`mt-0.5 h-4 w-4 shrink-0 ${syncOnlySignup ? 'text-heading-dark' : 'text-neutral-400'}`}
                    />
                    {item}
                  </li>
                ))}
              </ul>
              {syncOnlySignup ? (
                <Link
                  href="/partners/shopify-sync"
                  className="mt-8 inline-flex rounded-full bg-heading-dark px-6 py-2.5 text-sm font-semibold text-white hover:bg-heading-dark/90"
                >
                  Install from Shopify
                </Link>
              ) : (
                <p className="mt-8 text-sm font-semibold text-neutral-400">Coming soon</p>
              )}
            </div>

            {/* Pro */}
            <div
              className={`rounded-3xl bg-white p-8 shadow-sm ${syncOnlySignup ? 'opacity-60' : 'ring-2 ring-heading-dark'}`}
            >
              <p className="font-semibold italic text-neutral-800">Pro</p>
              <p className="mt-3 text-4xl font-bold">{formatPartnerMonthlyAmount('pro')}</p>
              <p className="mt-1 text-sm text-neutral-500">CAD / month</p>
              <span className="mt-4 inline-flex rounded-full bg-[#EDF2ED] px-3 py-1 text-xs font-semibold text-heading-dark">
                {PARTNER_TRIAL_LABEL_LONG}
              </span>
              <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Includes
              </p>
              <ul className="mt-3 space-y-2.5 text-sm text-neutral-700">
                {[
                  'Unlimited workshops',
                  'Artist Marketplace included',
                  '0% commission on tickets',
                  'Shopify Sync sold separately',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <IconCheck
                      className={`mt-0.5 h-4 w-4 shrink-0 ${syncOnlySignup ? 'text-neutral-400' : 'text-heading-dark'}`}
                    />
                    {item}
                  </li>
                ))}
              </ul>
              {!syncOnlySignup ? (
                <Link
                  href="/partners/signup"
                  className="mt-8 inline-flex rounded-full bg-heading-dark px-6 py-2.5 text-sm font-semibold text-white hover:bg-heading-dark/90"
                >
                  Start free trial
                </Link>
              ) : (
                <p className="mt-8 text-sm font-semibold text-neutral-400">Coming soon</p>
              )}
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-neutral-500">
            {syncOnlySignup
              ? `Install ${SHOPIFY_SYNC_PLAN_NAME} from Shopify Admin. Cancel anytime.`
              : `Join today. ${PARTNER_TRIAL_LABEL}, then ${formatPartnerPlansFromLine()}. Cancel anytime.`}
          </p>
        </div>
      </section>

      {/* FAQ — collapsed until opened */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
          <ExpandableSection label="Frequently asked questions">
            <PartnerFaqAccordion showSectionTitles />
          </ExpandableSection>
        </div>
      </section>

      <MarketingSiteFooter showStoreBadges />
    </div>
  )
}
