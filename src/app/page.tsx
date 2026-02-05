'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, useScroll, useTransform, useMotionValue } from 'framer-motion'
import { InfiniteGridBackground } from '@/components/ui/the-infinite-grid'
import { CATEGORIES } from '@/constants/categories'

const LANDING_CATEGORIES = CATEGORIES.filter((c) => c !== 'Other')
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
          className={`inline-block mr-[0.3em] ${greySet?.has(i) ? 'text-neutral-600' : ''}`}
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
    <div className="bg-white">
      {/* Scrollable spacer: 6 viewport heights so scroll position drives "page" */}
      <div
        className="overflow-x-hidden"
        style={{ height: `calc(100vh * ${NUM_SECTIONS})` }}
      />

      {/* Infinite grid background: fixed behind sections, cursor-reveal driven by section onMouseMove */}
      <InfiniteGridBackground
        mouseX={mouseX}
        mouseY={mouseY}
        gridOpacity={0.14}
        maskOpacity={0.5}
      />

      {/* Fixed full-screen layers: content does not move, only opacity crossfades */}
      {[
        { bg: 'bg-white/75', content: <Section1Hero /> },
        { bg: 'bg-white/75', content: <Section2Headline /> },
        { bg: 'bg-white/75', content: <Section4Tagline /> },
        { bg: 'bg-neutral-50/75', content: <Section5Categories /> },
        { bg: 'bg-white/75', content: <Section6Mastery /> },
        { bg: 'bg-neutral-50/75', content: <Section7WithFooter /> },
      ].map((section, i) => (
        <motion.div
          key={i}
          className={`fixed inset-0 z-10 flex flex-col items-center ${i === 5 ? 'justify-between' : 'justify-center'} px-4 ${section.bg}`}
          style={{
            opacity: opacities[i],
            scale: scales[i],
            pointerEvents: pointerEvents[i],
          }}
          initial={false}
          onMouseMove={handleMouseMove}
        >
          <div className={`flex flex-col w-full max-w-6xl mx-auto ${i === 5 ? 'flex-1 min-h-0' : ''} ${i !== 5 ? 'items-center justify-center' : ''}`}>
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
        className="mb-0 flex justify-center"
      >
        <Image
          src="/logo.png"
          alt="Offhrs"
          width={960}
          height={288}
          className="object-contain"
          priority
        />
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.35, ease: easeOut }}
        className="text-[2.7rem] md:text-[3.6rem] font-bold text-neutral-600 text-center mb-12 max-w-3xl -mt-12 whitespace-nowrap w-full"
      >
        Make your free time flourish
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 34 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4, ease: easeOut }}
        className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full"
      >
        <Link
          href={APP_STORE_URL}
          className="inline-flex items-center justify-center rounded-lg bg-neutral-900 text-white px-8 py-4 text-[1.35rem] font-medium hover:bg-neutral-800 transition-colors"
        >
          App Store
        </Link>
        <Link
          href={PLAY_STORE_URL}
          className="inline-flex items-center justify-center rounded-lg bg-neutral-900 text-white px-8 py-4 text-[1.35rem] font-medium hover:bg-neutral-800 transition-colors"
        >
          Google Play
        </Link>
      </motion.div>
    </motion.div>
  )
}

function Section2Headline() {
  return (
    <p className="text-[4.5rem] md:text-[5.4rem] lg:text-[7.2rem] font-bold text-neutral-900 text-center max-w-6xl leading-tight">
      Discover, book, and master{' '}
      <span className="text-neutral-600">your next passion project.</span>
    </p>
  )
}

function Section4Tagline() {
  return (
    <p className="text-[4.5rem] md:text-[5.4rem] lg:text-[7.2rem] font-bold text-neutral-900 text-center max-w-6xl leading-tight">
      Offhrs <span className="text-neutral-600">is your</span> companion <span className="text-neutral-600">for productive leisure, from</span> novice to master <span className="text-neutral-600">in the skills you&apos;ve always wanted to learn</span>
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
        className="text-[4.5rem] md:text-[5.4rem] lg:text-[7.2rem] font-bold text-neutral-900 text-center max-w-6xl leading-tight mb-8"
      >
        Master your skills.
      </motion.h2>
      <motion.p
        variants={fadeInUp}
        transition={transition}
        className="text-[2.7rem] md:text-[3.6rem] font-bold text-neutral-600 text-center mb-14 max-w-6xl leading-tight"
      >
        From pottery, coffee, culinary, beauty, wellness, floral, and more.
      </motion.p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 w-full max-w-5xl">
        {LANDING_CATEGORIES.map((name) => (
          <motion.div
            key={name}
            variants={fadeInUpScale}
            transition={transition}
            className="rounded-xl overflow-hidden border border-neutral-200 bg-white shadow-sm flex flex-col"
          >
            <div className="aspect-square bg-neutral-200 flex items-center justify-center text-neutral-600 text-[1.8rem] p-5 text-center">
              {name}
            </div>
            <p className="p-5 text-[1.8rem] font-medium text-neutral-900 text-center">
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
        className="text-[4.5rem] md:text-[5.4rem] lg:text-[7.2rem] font-bold text-neutral-900 text-center max-w-6xl leading-tight mb-8"
      >
        Track Your Mastery
      </motion.h2>
      <motion.p
        variants={fadeInUp}
        transition={transition}
        className="text-[2.7rem] md:text-[3.6rem] font-bold text-neutral-600 text-center mb-14 max-w-6xl leading-tight"
      >
        Level up your skills from Novice to Master, step-by-step.
      </motion.p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-5 w-full max-w-5xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.div
            key={n}
            variants={fadeInUpScale}
            transition={transition}
            className="aspect-[3/4] rounded-xl bg-neutral-200 flex items-center justify-center text-neutral-600 text-[1.8rem] border border-neutral-200"
          >
            Image {n}
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
        className="text-[3.6rem] md:text-[4.5rem] font-bold text-neutral-600 text-center mb-5"
      >
        Why wait?
      </motion.p>
      <motion.h2
        variants={fadeInUp}
        transition={transition}
        className="text-[5.4rem] md:text-[7.2rem] font-bold text-neutral-900 text-center mb-12"
      >
        Join the Fun.
      </motion.h2>
      <motion.div
        variants={fadeInUp}
        transition={transition}
        className="flex flex-col sm:flex-row gap-4"
      >
        <Link
          href={APP_STORE_URL}
          className="inline-flex items-center justify-center rounded-lg bg-neutral-900 text-white px-8 py-4 text-[1.35rem] font-medium hover:bg-neutral-800 transition-colors"
        >
          App Store
        </Link>
        <Link
          href={PLAY_STORE_URL}
          className="inline-flex items-center justify-center rounded-lg bg-neutral-900 text-white px-8 py-4 text-[1.35rem] font-medium hover:bg-neutral-800 transition-colors"
        >
          Google Play
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
    <footer className="w-full border-t border-neutral-200 bg-neutral-50 py-5 px-5 shrink-0">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-4 text-[1.05rem] text-neutral-600">
        <p>© {new Date().getFullYear()} Offhrs. All rights reserved.</p>
        <Link href="/admin" prefetch={false} className="hover:text-neutral-700 transition-colors font-medium">
          Admin
        </Link>
      </div>
    </footer>
  )
}
