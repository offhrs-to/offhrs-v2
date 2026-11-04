import Image from 'next/image'
import { Search, CalendarCheck, Sparkles, Palette, ShoppingBag, Heart } from 'lucide-react'
import { FloatingNav } from '@/components/marketing/floating-nav'
import { StoreBadges } from '@/components/marketing/store-badges'
import { ShopifyAppHandoff } from '@/components/marketing/shopify-app-handoff'
import { MarketingSiteFooter } from '@/components/marketing/site-footer'

const WORKSHOP_STEPS = [
  {
    icon: Search,
    title: '1. Find your workshop',
    description: 'Browse local creative workshops and filter by the skills you want to try.',
  },
  {
    icon: CalendarCheck,
    title: '2. Book your spot',
    description: 'Reserve directly in the offhrs app, or through the host’s own booking link.',
  },
  {
    icon: Sparkles,
    title: '3. Show up & learn',
    description: 'Attend in person, meet makers, and leave with a new skill you’ll want to keep.',
  },
]

const MARKETPLACE_STEPS = [
  {
    icon: Palette,
    title: '1. Browse curated art',
    description: 'Explore handmade pieces from local artists — all in one place.',
  },
  {
    icon: ShoppingBag,
    title: '2. Purchase your way',
    description: 'Buy on offhrs. Have it shipped, or arrange pickup with the seller.',
  },
  {
    icon: Heart,
    title: '3. Curate your collection',
    description: 'Bring home something handmade and keep building a space that feels like you.',
  },
]

function FeatureSplit({
  title,
  body,
  imageSrc,
  imageAlt,
  imageLeft,
  tone = 'cream',
}: {
  title: string
  body: string
  imageSrc: string
  imageAlt: string
  imageLeft?: boolean
  tone?: 'cream' | 'white'
}) {
  return (
    <section className={tone === 'cream' ? 'bg-[#F7F5F1]' : 'bg-white'}>
      <div
        className={`mx-auto flex max-w-6xl flex-col items-center justify-center gap-8 px-5 py-14 sm:gap-12 sm:px-6 sm:py-20 md:gap-32 md:py-28 lg:gap-40 ${
          imageLeft ? 'md:flex-row' : 'md:flex-row-reverse'
        }`}
      >
        <div className="w-full max-w-md shrink-0 md:w-[28rem]">
          <div className="overflow-hidden rounded-[1.5rem] sm:rounded-[2rem]">
            <Image
              src={imageSrc}
              alt={imageAlt}
              width={1200}
              height={1200}
              className="aspect-square w-full object-cover"
              sizes="(max-width: 768px) 100vw, 28rem"
            />
          </div>
        </div>
        <div className="w-full max-w-[22rem] shrink-0 text-center md:text-left">
          <h2 className="text-[1.65rem] font-bold leading-[1.15] tracking-tight text-neutral-900 sm:text-3xl md:text-[2.35rem]">
            {title}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-neutral-600 sm:mt-6 sm:text-base sm:text-[1.05rem] sm:leading-[1.65]">
            {body}
          </p>
        </div>
      </div>
    </section>
  )
}

function HowItWorks({
  heading,
  steps,
  tone = 'cream',
}: {
  heading: string
  steps: typeof WORKSHOP_STEPS
  tone?: 'cream' | 'white'
}) {
  return (
    <section className={tone === 'cream' ? 'bg-[#F7F5F1]' : 'bg-white'}>
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20 md:py-24">
        <h2 className="text-center text-[1.65rem] font-bold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl">
          {heading}
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-10 sm:mt-14 sm:gap-12 md:grid-cols-3 md:gap-10">
          {steps.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center">
                <Icon className="h-12 w-12 text-neutral-900" strokeWidth={1.35} />
              </div>
              <h3 className="text-lg font-bold text-neutral-900">{title}</h3>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-600 sm:text-base">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <div className="bg-white">
      <ShopifyAppHandoff />
      <FloatingNav />

      {/* Hero — contain on mobile so logo/slogan aren’t cropped; cover on desktop */}
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-[#F5F2ED]">
        <h1 className="sr-only">
          offhrs — Powered by local artists, made for local artists. Discover workshops and shop local art.
        </h1>
        {/* Desktop full-bleed */}
        <div className="absolute inset-0 hidden md:block">
          <Image
            src="/landing/hero.png"
            alt="offhrs — Powered by local artists, made for local artists"
            fill
            priority
            quality={95}
            className="object-cover object-center"
            sizes="100vw"
          />
        </div>
        {/* Mobile: show full illustration */}
        <div className="relative flex flex-1 items-center justify-center px-3 pt-20 pb-2 md:hidden">
          <Image
            src="/landing/hero.png"
            alt="offhrs — Powered by local artists, made for local artists"
            width={4800}
            height={2700}
            priority
            quality={95}
            className="h-auto w-full max-h-[min(68svh,560px)] object-contain"
            sizes="100vw"
          />
        </div>
        <div className="relative z-10 mt-auto flex justify-center px-4 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] pt-4 md:pt-28">
          <StoreBadges variant="dark" />
        </div>
      </section>

      <FeatureSplit
        imageLeft
        tone="cream"
        title="Discover local workshops with ease"
        body="No more schedule tetris and endless browser tabs. Find and book a creative workshop that sparks your interest — all with one tap. It’s that easy."
        imageSrc="/landing/workshop-feature.jpg"
        imageAlt="Illustrated hands shaping clay at a creative workshop"
      />

      <FeatureSplit
        tone="white"
        title="Buy art from local talents"
        body="Skip the crowded weekend market. Browse handmade pieces from local artists and shop online — ship to your door, or arrange pickup with the seller."
        imageSrc="/landing/marketplace-feature.jpg"
        imageAlt="Illustrated handmade ceramics and art ready to ship or pick up"
      />

      <HowItWorks heading="How Workshop Discovery works" steps={WORKSHOP_STEPS} tone="cream" />
      <HowItWorks heading="How Artist Marketplace works" steps={MARKETPLACE_STEPS} tone="white" />

      <MarketingSiteFooter showStoreBadges />
    </div>
  )
}
