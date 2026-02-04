'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CATEGORIES } from '@/constants/categories'

const LANDING_CATEGORIES = CATEGORIES.filter((c) => c !== 'Other')

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || '#'
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '#'

const fadeInUp = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0 },
}

const viewport = { once: true, amount: 0.25 }
const transition = { duration: 0.5, ease: [0.22, 1, 0.36, 1] }

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Section 1 – Hero: entrance on load */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="text-xl md:text-2xl text-slate-600 text-center mb-10 max-w-md"
          >
            Make your free time flourish
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
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

      {/* Section 2 */}
      <motion.section
        initial="initial"
        whileInView="animate"
        viewport={viewport}
        variants={fadeInUp}
        transition={transition}
        className="min-h-[80vh] flex items-center justify-center px-4 py-20"
      >
        <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 text-center max-w-4xl leading-tight">
          Discover, book, and master your next passion project.
        </p>
      </motion.section>

      {/* Section 3 */}
      <motion.section
        initial="initial"
        whileInView="animate"
        viewport={viewport}
        variants={fadeInUp}
        transition={transition}
        className="min-h-[80vh] flex items-center justify-center px-4 py-20 bg-slate-50"
      >
        <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 text-center max-w-4xl leading-tight">
          Don&apos;t just spend your time off - create with it
        </p>
      </motion.section>

      {/* Section 4 */}
      <motion.section
        initial="initial"
        whileInView="animate"
        viewport={viewport}
        variants={fadeInUp}
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
              staggerChildren: 0.06,
              delayChildren: 0.15,
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
              variants={fadeInUp}
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
              staggerChildren: 0.08,
              delayChildren: 0.1,
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
              variants={fadeInUp}
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
        variants={fadeInUp}
        transition={transition}
        className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-20 bg-slate-50"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-10">
          Join the Fun.
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
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
        </div>
      </motion.section>
    </div>
  )
}
