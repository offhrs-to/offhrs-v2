'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { CATEGORIES } from '@/constants/categories'

const LANDING_CATEGORIES = CATEGORIES.filter((c) => c !== 'Other')

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || '#'
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '#'

const easeOut = [0.16, 1, 0.3, 1] as const

const fadeInUp = {
  initial: { opacity: 0, y: 56 },
  animate: { opacity: 1, y: 0 },
}

const fadeInUpScale = {
  initial: { opacity: 0, y: 48, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
}

const viewport = { once: true, amount: 0.15 }
const transition = { duration: 0.7, ease: easeOut }

/** Wraps section content and drives scale + opacity from scroll position (Stryds-style) */
function ScrollSection({
  children,
  className = '',
  bgClass = 'bg-white',
}: {
  children: React.ReactNode
  className?: string
  bgClass?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const scale = useTransform(scrollYProgress, [0, 0.2, 0.7, 1], [0.96, 1, 1, 1.12])
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.7, 1], [0, 1, 1, 0])

  return (
    <section
      ref={ref}
      className={`h-screen min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden ${bgClass} ${className}`}
    >
      <motion.div
        style={{ scale, opacity }}
        className="flex flex-col items-center justify-center w-full max-w-6xl mx-auto"
      >
        {children}
      </motion.div>
    </section>
  )
}

function AnimatedHeadline({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const words = text.split(/\s+/)
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
          className="inline-block mr-[0.25em]"
        >
          {word}
        </motion.span>
      ))}
    </motion.p>
  )
}

export default function Home() {
  return (
    <div className="bg-white">
      {/* Section 1 – Hero */}
      <ScrollSection bgClass="bg-white">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut }}
          className="flex flex-col items-center"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease: easeOut }}
            className="mb-2"
          >
            <Image
              src="/logo.png"
              alt="Offhrs"
              width={800}
              height={240}
              className="object-contain"
              priority
            />
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.35, ease: easeOut }}
            className="text-4xl md:text-5xl text-slate-600 text-center mb-10 max-w-2xl"
          >
            Make your free time flourish
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: easeOut }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <Link
              href={APP_STORE_URL}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 text-white px-6 py-3 text-lg font-medium hover:bg-slate-800 transition-colors"
            >
              App Store
            </Link>
            <Link
              href={PLAY_STORE_URL}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 text-white px-6 py-3 text-lg font-medium hover:bg-slate-800 transition-colors"
            >
              Google Play
            </Link>
          </motion.div>
        </motion.div>
      </ScrollSection>

      {/* Section 2 */}
      <ScrollSection bgClass="bg-white">
        <AnimatedHeadline
          text="Discover, book, and master your next passion project."
          className="text-6xl md:text-7xl lg:text-8xl font-bold text-slate-900 text-center max-w-5xl leading-tight"
        />
      </ScrollSection>

      {/* Section 3 */}
      <ScrollSection bgClass="bg-slate-50">
        <AnimatedHeadline
          text="Don't just spend your time off - create with it"
          className="text-6xl md:text-7xl lg:text-8xl font-bold text-slate-900 text-center max-w-5xl leading-tight"
        />
      </ScrollSection>

      {/* Section 4 */}
      <ScrollSection bgClass="bg-white">
        <p className="text-5xl md:text-6xl lg:text-7xl text-slate-700 text-center max-w-5xl leading-snug">
          Offhrs is your companion for productive leisure, from novice to master in the skills you&apos;ve always wanted to learn
        </p>
      </ScrollSection>

      {/* Section 5 – Master your skills + categories */}
      <ScrollSection bgClass="bg-slate-50">
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
            className="text-6xl md:text-7xl font-bold text-slate-900 text-center mb-6"
          >
            Master your skills.
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            transition={transition}
            className="text-4xl text-slate-600 text-center mb-12 max-w-4xl"
          >
            From pottery, coffee, culinary, beauty, wellness, floral, and more.
          </motion.p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
            {LANDING_CATEGORIES.map((name) => (
              <motion.div
                key={name}
                variants={fadeInUpScale}
                transition={transition}
                className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm flex flex-col"
              >
                <div className="aspect-square bg-slate-200 flex items-center justify-center text-slate-500 text-2xl p-4 text-center">
                  {name}
                </div>
                <p className="p-4 text-2xl font-medium text-slate-900 text-center">
                  {name}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </ScrollSection>

      {/* Section 6 – Track Your Mastery */}
      <ScrollSection bgClass="bg-white">
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
            className="text-6xl md:text-7xl font-bold text-slate-900 text-center mb-6"
          >
            Track Your Mastery
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            transition={transition}
            className="text-4xl text-slate-600 text-center mb-12 max-w-4xl"
          >
            Level up your skills from Novice to Master, step-by-step.
          </motion.p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full max-w-4xl">
            {[1, 2, 3, 4, 5].map((n) => (
              <motion.div
                key={n}
                variants={fadeInUpScale}
                transition={transition}
                className="aspect-[3/4] rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 text-2xl border border-slate-200"
              >
                Image {n}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </ScrollSection>

      {/* Section 7 – Join the Fun */}
      <ScrollSection bgClass="bg-slate-50">
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
          <motion.h2
            variants={fadeInUp}
            transition={transition}
            className="text-6xl md:text-7xl font-bold text-slate-900 text-center mb-10"
          >
            Join the Fun.
          </motion.h2>
          <motion.div
            variants={fadeInUp}
            transition={transition}
            className="flex flex-col sm:flex-row gap-3"
          >
            <Link
              href={APP_STORE_URL}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 text-white px-6 py-3 text-lg font-medium hover:bg-slate-800 transition-colors"
            >
              App Store
            </Link>
            <Link
              href={PLAY_STORE_URL}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 text-white px-6 py-3 text-lg font-medium hover:bg-slate-800 transition-colors"
            >
              Google Play
            </Link>
          </motion.div>
        </motion.div>
      </ScrollSection>
    </div>
  )
}
