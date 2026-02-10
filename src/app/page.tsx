'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, useScroll, useTransform, useMotionValue } from 'framer-motion'
import { InfiniteGridBackground } from '@/components/ui/the-infinite-grid'
// Master your skills section: categories with Other last
const LANDING_CATEGORIES: string[] = [
  'Beauty & Fragrance',
  'Culinary',
  'Coffee',
  'Floral',
  'Pottery',
  'Music',
  'Wellness',
  'Other',
]
// Novice icon path per category (same assets as mobile app)
const CATEGORY_NOVICE_ICONS: Record<string, string> = {
  'Beauty & Fragrance': '/categories/beauty-fragrance-novice.png',
  Culinary: '/categories/culinary-novice.png',
  Coffee: '/categories/coffee-novice.png',
  Floral: '/categories/floral-novice.png',
  Pottery: '/categories/pottery-novice.png',
  Music: '/categories/music-novice.png',
  Wellness: '/categories/wellness-novice.png',
  Other: '/categories/other-novice.png',
}
const CATEGORY_ICONS_CACHE = '4'
// Other category icons for Track Your Mastery (Novice → Master)
const MASTERY_OTHER_ICONS: { src: string; label: string }[] = [
  { src: '/categories/other-novice.png', label: 'Novice' },
  { src: '/categories/other-intermediate.png', label: 'Intermediate' },
  { src: '/categories/other-advanced.png', label: 'Advanced' },
  { src: '/categories/other-expert.png', label: 'Expert' },
  { src: '/categories/other-master.png', label: 'Master' },
]
const NUM_SECTIONS = 6

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || '#'
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '#'

const easeOut = [0.16, 1, 0.3, 1] as const

const fadeInUp = {
  initial: { opacity: 0, y: 68 },
  animate: { opacity: 1, y: 0 },
}

const fadeInUpScale = {
  initial: { opacity: 0, y: 58, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
}

const viewport = { once: true, amount: 0.15 }
const transition = { duration: 0.7, ease: easeOut }

function AnimatedHeadline({
  text,
  className,
  greyWordIndices,
}: {
  text: string
  className?: string
  /** Word indices to render in grey (e.g. [0,1,2,3,8,9]) */
  greyWordIndices?: number[]
}) {
  const words = text.split(/\s+/)
  const greySet = greyWordIndices ? new Set(greyWordIndices) : null
  return (
    <motion.p
      className={className}
      initial="initial"
      whileInView="animate"
      viewport={viewport}
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: 0.04,
            delayChildren: 0.1,
          },
        },
      }}
    >
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          variants={fadeInUp}
          transition={transition}
          className={`inline-block mr-[0.3em] ${greySet?.has(i) ? 'text-primary' : ''}`}
        >
          {word}
        </motion.span>
      ))}
    </motion.p>
  )
}

/** Smoothstep easing: progress 0→1 becomes a smooth S-curve */
function smoothstep(t: number) {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

/** Returns opacity 0-1 for layer i based on scroll Y. Crossfade happens over a short scroll range with smooth easing to reduce overlap. */
const CROSSFADE_FRACTION = 0.42 // transition in last 42% of viewport scroll (smooth, slightly slower)
const SCALE_MIN = 0.88 // min scale when fading; current page shrinks to this, next page zooms from this to 1

function useLayerOpacity(scrollY: ReturnType<typeof useScroll>['scrollY'], index: number) {
  return useTransform(scrollY, (y) => {
    const v = typeof window === 'undefined' ? 900 : window.innerHeight
    const pageIndex = Math.min(Math.floor(y / v), NUM_SECTIONS - 1)
    const rawProgress = v > 0 ? Math.min((y % v) / v, 1) : 0
    // Compress transition into last CROSSFADE_FRACTION of section scroll, then apply smoothstep
    const t = rawProgress <= 1 - CROSSFADE_FRACTION ? 0 : (rawProgress - (1 - CROSSFADE_FRACTION)) / CROSSFADE_FRACTION
    const progress = smoothstep(t)
    if (index < pageIndex) return 0
    if (index === pageIndex) return 1 - progress
    if (index === pageIndex + 1) return progress
    return 0
  })
}

/** Returns scale for layer i, synced with crossfade: content scales up as it fades in, down as it fades out. */
function useLayerScale(scrollY: ReturnType<typeof useScroll>['scrollY'], index: number) {
  return useTransform(scrollY, (y) => {
    const v = typeof window === 'undefined' ? 900 : window.innerHeight
    const pageIndex = Math.min(Math.floor(y / v), NUM_SECTIONS - 1)
    const rawProgress = v > 0 ? Math.min((y % v) / v, 1) : 0
    const t = rawProgress <= 1 - CROSSFADE_FRACTION ? 0 : (rawProgress - (1 - CROSSFADE_FRACTION)) / CROSSFADE_FRACTION
    const progress = smoothstep(t)
    if (index < pageIndex) return SCALE_MIN
    if (index === pageIndex) return SCALE_MIN + (1 - SCALE_MIN) * (1 - progress) // 1 -> SCALE_MIN as we scroll
    if (index === pageIndex + 1) return SCALE_MIN + (1 - SCALE_MIN) * progress // SCALE_MIN -> 1 as we scroll
    return SCALE_MIN
  })
}

export default function Home() {
  const { scrollY } = useScroll()
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top } = e.currentTarget.getBoundingClientRect()
    mouseX.set(e.clientX - left)
    mouseY.set(e.clientY - top)
  }

  const opacity0 = useLayerOpacity(scrollY, 0)
  const opacity1 = useLayerOpacity(scrollY, 1)
  const opacity2 = useLayerOpacity(scrollY, 2)
  const opacity3 = useLayerOpacity(scrollY, 3)
  const opacity4 = useLayerOpacity(scrollY, 4)
  const opacity5 = useLayerOpacity(scrollY, 5)
  const scale0 = useLayerScale(scrollY, 0)
  const scale1 = useLayerScale(scrollY, 1)
  const scale2 = useLayerScale(scrollY, 2)
  const scale3 = useLayerScale(scrollY, 3)
  const scale4 = useLayerScale(scrollY, 4)
  const scale5 = useLayerScale(scrollY, 5)

  const opacities = [opacity0, opacity1, opacity2, opacity3, opacity4, opacity5]
  const scales = [scale0, scale1, scale2, scale3, scale4, scale5]
  const pointerEvents0 = useTransform(opacity0, (o) => (o > 0.5 ? 'auto' : 'none'))
  const pointerEvents1 = useTransform(opacity1, (o) => (o > 0.5 ? 'auto' : 'none'))
  const pointerEvents2 = useTransform(opacity2, (o) => (o > 0.5 ? 'auto' : 'none'))
  const pointerEvents3 = useTransform(opacity3, (o) => (o > 0.5 ? 'auto' : 'none'))
  const pointerEvents4 = useTransform(opacity4, (o) => (o > 0.5 ? 'auto' : 'none'))
  const pointerEvents5 = useTransform(opacity5, (o) => (o > 0.5 ? 'auto' : 'none'))
  const pointerEvents = [
    pointerEvents0,
    pointerEvents1,
    pointerEvents2,
    pointerEvents3,
    pointerEvents4,
    pointerEvents5,
  ]

  return (
    <div className="bg-white overflow-x-hidden">
      {/* Scrollable spacer: 6 viewport heights so scroll position drives "page" */}
      <div
        className="overflow-x-hidden"
        style={{ height: `calc(100vh * ${NUM_SECTIONS})` }}
      />

      {/* Infinite grid background: fixed behind sections, cursor-reveal driven by section onMouseMove */}
      <InfiniteGridBackground
        mouseX={mouseX}
        mouseY={mouseY}
        gridOpacity={0.18}
        maskOpacity={0.58}
      />

      {/* Fixed full-screen layers: content does not move, only opacity crossfades */}
      {[
        { bg: 'bg-white/70', content: <Section1Hero /> },
        { bg: 'bg-white/70', content: <Section2Headline /> },
        { bg: 'bg-white/70', content: <Section4Tagline /> },
        { bg: 'bg-neutral-50/70', content: <Section5Categories /> },
        { bg: 'bg-white/70', content: <Section6Mastery /> },
        { bg: 'bg-neutral-50/70', content: <Section7WithFooter /> },
      ].map((section, i) => (
        <motion.div
          key={i}
          className={`fixed inset-0 z-10 flex flex-col items-center ${i === 5 ? 'justify-between' : 'justify-center'} px-4 ${section.bg} max-md:pt-[max(env(safe-area-inset-top,0px),3.5rem)] max-md:pb-[max(env(safe-area-inset-bottom,0px),5rem)]`}
          style={{
            opacity: opacities[i],
            scale: scales[i],
            pointerEvents: pointerEvents[i],
          }}
          initial={false}
          onMouseMove={handleMouseMove}
        >
          <div className={`flex flex-col w-full max-w-4xl mx-auto ${i === 5 ? 'flex-1 min-h-0' : ''} ${i !== 5 ? 'items-center justify-center' : ''}`}>
            {section.content}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function Section1Hero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 48 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: easeOut }}
      className="flex flex-col items-center justify-center w-full"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, ease: easeOut }}
        className="mb-0 flex justify-center max-w-[90vw] ml-2"
      >
        <Image
          src="/logo.png"
          alt="Offhrs"
          width={480}
          height={144}
          className="object-contain w-full max-h-24 sm:max-h-28 md:max-h-32"
          priority
        />
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.35, ease: easeOut }}
        className="text-xl sm:text-2xl md:text-3xl font-bold text-primary text-center mb-6 max-w-2xl -mt-6 w-full"
      >
        Make your free time flourish
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 34 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4, ease: easeOut }}
        className="flex flex-col gap-3 items-center justify-center w-full"
      >
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={APP_STORE_URL}
            className="inline-flex items-center justify-center rounded-lg bg-heading-dark text-white px-5 py-2.5 text-sm font-medium hover:bg-heading-dark/90 transition-colors w-[11rem] min-w-[11rem]"
          >
            App Store
          </Link>
          <Link
            href={PLAY_STORE_URL}
            className="inline-flex items-center justify-center rounded-lg bg-heading-dark text-white px-5 py-2.5 text-sm font-medium hover:bg-heading-dark/90 transition-colors w-[11rem] min-w-[11rem]"
          >
            Google Play
          </Link>
        </div>
        <Link
          href="/workshops"
          className="inline-flex items-center justify-center rounded-lg border-2 border-heading-dark text-heading-dark bg-transparent px-5 py-2.5 text-sm font-medium hover:bg-heading-dark/5 transition-colors"
        >
          Browse Workshops
        </Link>
      </motion.div>
    </motion.div>
  )
}

function Section2Headline() {
  return (
    <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-heading-dark text-center max-w-4xl leading-tight px-2">
      Discover, book, and master{' '}
      <span className="text-primary">your next passion project.</span>
    </p>
  )
}

function Section4Tagline() {
  return (
    <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-heading-dark text-center max-w-4xl leading-tight px-2">
      Offhrs <span className="text-primary">is your</span> companion <span className="text-primary">for productive leisure, from</span> novice to master <span className="text-primary">in the skills you&apos;ve always wanted to learn</span>
    </p>
  )
}

function Section5Categories() {
  return (
    <motion.div
      initial="initial"
      whileInView="animate"
      viewport={viewport}
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: 0.07,
            delayChildren: 0.2,
          },
        },
      }}
      className="flex flex-col items-center w-full"
    >
      <motion.h2
        variants={fadeInUp}
        transition={transition}
        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-heading-dark text-center max-w-4xl leading-tight mb-4"
      >
        Master your skills.
      </motion.h2>
      <motion.p
        variants={fadeInUp}
        transition={transition}
        className="text-lg sm:text-xl md:text-2xl font-bold text-primary text-center mb-8 max-w-4xl leading-tight"
      >
        From pottery, coffee, culinary, beauty, wellness, floral, and more.
      </motion.p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-4xl">
        {LANDING_CATEGORIES.map((name) => (
          <motion.div
            key={name}
            variants={fadeInUpScale}
            transition={transition}
            className="rounded-lg overflow-hidden border border-neutral-200 bg-white shadow-sm flex flex-col min-w-0"
          >
            <div className="aspect-square bg-white flex items-center justify-center p-2 sm:p-4">
              <div className={`rounded-full border-2 border-primary overflow-hidden bg-white w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] md:w-[152px] md:h-[152px] md:shrink-0 ${name === 'Other' ? 'flex items-center justify-center' : 'relative'}`}>
                {name === 'Other' ? (
                  <Image
                    src={`${CATEGORY_NOVICE_ICONS[name] ?? '/categories/other-novice.png'}?v=${CATEGORY_ICONS_CACHE}`}
                    alt={name}
                    width={96}
                    height={96}
                    className="object-contain"
                  />
                ) : (
                  <Image
                    src={`${CATEGORY_NOVICE_ICONS[name] ?? '/categories/other-novice.png'}?v=${CATEGORY_ICONS_CACHE}`}
                    alt={name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 152px"
                  />
                )}
              </div>
            </div>
            <p className="p-3 text-sm sm:text-base font-medium text-heading-dark text-center">
              {name}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

function Section6Mastery() {
  return (
    <motion.div
      initial="initial"
      whileInView="animate"
      viewport={viewport}
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: 0.1,
            delayChildren: 0.15,
          },
        },
      }}
      className="flex flex-col items-center w-full"
    >
      <motion.h2
        variants={fadeInUp}
        transition={transition}
        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-heading-dark text-center max-w-4xl leading-tight mb-4"
      >
        Track Your Mastery
      </motion.h2>
      <motion.p
        variants={fadeInUp}
        transition={transition}
        className="text-lg sm:text-xl md:text-2xl font-bold text-primary text-center mb-8 max-w-4xl leading-tight"
      >
        Level up your skills from Novice to Master, step-by-step.
      </motion.p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 w-full max-w-4xl">
        {MASTERY_OTHER_ICONS.map(({ src, label }) => (
          <motion.div
            key={label}
            variants={fadeInUpScale}
            transition={transition}
            className="aspect-[3/4] rounded-lg bg-white flex flex-col items-center justify-center p-3 border border-neutral-200 shadow-sm overflow-hidden min-w-0"
          >
            <div className="relative w-full flex-1 min-h-0 flex items-center justify-center min-w-0">
              <Image
                src={`${src}?v=${CATEGORY_ICONS_CACHE}`}
                alt={label}
                width={120}
                height={120}
                className="object-contain max-w-full max-h-full"
              />
            </div>
            <p className="text-primary font-medium text-sm sm:text-base text-center mt-2">
              {label}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

function Section7Join() {
  return (
    <motion.div
      initial="initial"
      whileInView="animate"
      viewport={viewport}
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: 0.12,
            delayChildren: 0.1,
          },
        },
      }}
      className="flex flex-col items-center"
    >
      <motion.p
        variants={fadeInUp}
        transition={transition}
        className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary text-center mb-3"
      >
        Why wait?
      </motion.p>
      <motion.h2
        variants={fadeInUp}
        transition={transition}
        className="text-3xl sm:text-4xl md:text-5xl font-bold text-heading-dark text-center mb-6"
      >
        Join the Fun
      </motion.h2>
      <motion.div
        variants={fadeInUp}
        transition={transition}
        className="flex flex-col gap-3 items-center"
      >
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={APP_STORE_URL}
            className="inline-flex items-center justify-center rounded-lg bg-heading-dark text-white px-5 py-2.5 text-sm font-medium hover:bg-heading-dark/90 transition-colors w-[11rem] min-w-[11rem]"
          >
            App Store
          </Link>
          <Link
            href={PLAY_STORE_URL}
            className="inline-flex items-center justify-center rounded-lg bg-heading-dark text-white px-5 py-2.5 text-sm font-medium hover:bg-heading-dark/90 transition-colors w-[11rem] min-w-[11rem]"
          >
            Google Play
          </Link>
        </div>
        <Link
          href="/workshops"
          className="inline-flex items-center justify-center rounded-lg border-2 border-heading-dark text-heading-dark bg-transparent px-5 py-2.5 text-sm font-medium hover:bg-heading-dark/5 transition-colors"
        >
          Browse Workshops
        </Link>
      </motion.div>
    </motion.div>
  )
}

function Section7WithFooter() {
  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        <Section7Join />
      </div>
      <LandingFooter />
    </>
  )
}

function LandingFooter() {
  return (
    <footer className="w-full border-t border-neutral-200 bg-neutral-50 py-3 px-4 shrink-0">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3 text-sm text-primary">
        <p>© {new Date().getFullYear()} Offhrs. All rights reserved.</p>
        <Link href="/admin" prefetch={false} className="hover:text-primary/90 transition-colors font-medium">
          Admin
        </Link>
      </div>
    </footer>
  )
}
