'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
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
    <div className="min-h-screen bg-white">
      {/* Section 1 – Hero: entrance on load */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut }}
          className="flex flex-col items-center"
        >
          <Image
            src="/logo.png"
            alt="Offhrs"
            width={200}
            height={60}
            className="object-contain mb-6"
            priority
          />
          <motion.p
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: easeOut }}
            className="text-xl md:text-2xl text-slate-600 text-center mb-10 max-w-md"
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
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 text-white px-6 py-3 text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              App Store
            </Link>
            <Link
              href={PLAY_STORE_URL}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 text-white px-6 py-3 text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Google Play
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Section 2 – word-staggered headline */}
      <section className="min-h-[80vh] flex items-center justify-center px-4 py-20">
        <AnimatedHeadline
          text="Discover, book, and master your next passion project."
          className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 text-center max-w-4xl leading-tight"
        />
      </section>

      {/* Section 3 */}
      <section className="min-h-[80vh] flex items-center justify-center px-4 py-20 bg-slate-50">
        <AnimatedHeadline
          text="Don't just spend your time off - create with it"
          className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 text-center max-w-4xl leading-tight"
        />
      </section>

      {/* Section 4 */}
      <motion.section
        initial="initial"
        whileInView="animate"
        viewport={viewport}
        variants={fadeInUpScale}
        transition={transition}
        className="min-h-[80vh] flex items-center justify-center px-4 py-20"
      >
        <p className="text-2xl md:text-3xl lg:text-4xl text-slate-700 text-center max-w-4xl leading-snug">
          Offhrs is your companion for productive leisure, from novice to master in the skills you&apos;ve always wanted to learn
        </p>
      </motion.section>

      {/* Section 5 – Master your skills + categories (staggered tiles) */}
      <motion.section
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
        className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-20 bg-slate-50"
      >
        <motion.h2
          variants={fadeInUp}
          transition={transition}
          className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4"
        >
          Master your skills.
        </motion.h2>
        <motion.p
          variants={fadeInUp}
          transition={transition}
          className="text-lg text-slate-600 text-center mb-12 max-w-2xl"
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
              <div className="aspect-square bg-slate-200 flex items-center justify-center text-slate-500 text-xs p-2 text-center">
                {name}
              </div>
              <p className="p-3 text-sm font-medium text-slate-900 text-center">
                {name}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Section 6 – Track Your Mastery (staggered placeholders) */}
      <motion.section
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
        className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-20"
      >
        <motion.h2
          variants={fadeInUp}
          transition={transition}
          className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4"
        >
          Track Your Mastery
        </motion.h2>
        <motion.p
          variants={fadeInUp}
          transition={transition}
          className="text-lg text-slate-600 text-center mb-12 max-w-2xl"
        >
          Level up your skills from Novice to Master, step-by-step.
        </motion.p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full max-w-4xl">
          {[1, 2, 3, 4, 5].map((n) => (
            <motion.div
              key={n}
              variants={fadeInUpScale}
              transition={transition}
              className="aspect-[3/4] rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 text-sm border border-slate-200"
            >
              Image {n}
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Section 7 – Join the Fun */}
      <motion.section
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
        className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-20 bg-slate-50"
      >
        <motion.h2
          variants={fadeInUp}
          transition={transition}
          className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-10"
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
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 text-white px-6 py-3 text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            App Store
          </Link>
          <Link
            href={PLAY_STORE_URL}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 text-white px-6 py-3 text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Google Play
          </Link>
        </motion.div>
      </motion.section>
    </div>
  )
}
