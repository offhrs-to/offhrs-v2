'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CATEGORIES } from '@/constants/categories'

const LANDING_CATEGORIES = CATEGORIES.filter((c) => c !== 'Other')

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || '#'
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '#'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Section 1 – Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
        <Image
          src="/logo.png"
          alt="Offhrs"
          width={200}
          height={60}
          className="object-contain mb-6"
          priority
        />
        <p className="text-xl md:text-2xl text-slate-600 text-center mb-10 max-w-md">
          Make your free time flourish
        </p>
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
      </section>

      {/* Section 2 */}
      <section className="min-h-[80vh] flex items-center justify-center px-4 py-20">
        <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 text-center max-w-4xl leading-tight">
          Discover, book, and master your next passion project.
        </p>
      </section>

      {/* Section 3 */}
      <section className="min-h-[80vh] flex items-center justify-center px-4 py-20 bg-slate-50">
        <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 text-center max-w-4xl leading-tight">
          Don&apos;t just spend your time off - create with it
        </p>
      </section>

      {/* Section 4 */}
      <section className="min-h-[80vh] flex items-center justify-center px-4 py-20">
        <p className="text-2xl md:text-3xl lg:text-4xl text-slate-700 text-center max-w-4xl leading-snug">
          Offhrs is your companion for productive leisure, from novice to master in the skills you&apos;ve always wanted to learn
        </p>
      </section>

      {/* Section 5 – Master your skills + categories */}
      <section className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-20 bg-slate-50">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4">
          Master your skills.
        </h2>
        <p className="text-lg text-slate-600 text-center mb-12 max-w-2xl">
          From pottery, coffee, culinary, beauty, wellness, floral, and more.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
          {LANDING_CATEGORIES.map((name) => (
            <div
              key={name}
              className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm flex flex-col"
            >
              <div className="aspect-square bg-slate-200 flex items-center justify-center text-slate-500 text-xs p-2 text-center">
                {/* Placeholder: replace with /placeholders/category-{slug}.jpg */}
                {name}
              </div>
              <p className="p-3 text-sm font-medium text-slate-900 text-center">
                {name}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 6 – Track Your Mastery */}
      <section className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4">
          Track Your Mastery
        </h2>
        <p className="text-lg text-slate-600 text-center mb-12 max-w-2xl">
          Level up your skills from Novice to Master, step-by-step.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full max-w-4xl">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className="aspect-[3/4] rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 text-sm border border-slate-200"
            >
              {/* Placeholder: replace with /placeholders/mastery-{n}.jpg */}
              Image {n}
            </div>
          ))}
        </div>
      </section>

      {/* Section 7 – Join the Fun */}
      <section className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-20 bg-slate-50">
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
      </section>
    </div>
  )
}
