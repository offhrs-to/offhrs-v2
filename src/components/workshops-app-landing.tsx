import Link from 'next/link'
import { ArrowLeft, Smartphone } from 'lucide-react'
import Navbar from '@/components/navbar'
import { Button } from '@/components/ui/button'

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || '#'
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '#'

type WorkshopsAppLandingProps = {
  /** Optional workshop title — when present we tailor the headline so a
   *  shared link (e.g. /workshops/123) feels personalized while still
   *  driving the install. */
  workshopTitle?: string | null
  /** Optional category badge — surfaced when we have one. */
  category?: string | null
}

/**
 * Public landing shown at /workshops and /workshops/[id].
 *
 * The web booking flow is intentionally retired. All consumer browsing and
 * checkout happens in the mobile app. This page exists to:
 *   1. Keep public/shared URLs alive (no 404s for links in iMessage, search
 *      results, social posts, etc.).
 *   2. Drive App Store / Play Store installs from any web entry point.
 *   3. Preserve SEO metadata on /workshops/[id] (handled by the page's own
 *      `generateMetadata`) so link previews still render the workshop name.
 */
export default function WorkshopsAppLanding({
  workshopTitle,
  category,
}: WorkshopsAppLandingProps) {
  const headline = workshopTitle
    ? `Book "${workshopTitle}" in the offhrs app`
    : 'Browse and book workshops in the offhrs app'

  const subline = workshopTitle
    ? 'Workshop details, secure checkout, and your booking history all live in the offhrs mobile app. Download it free to view this workshop and reserve your spot.'
    : 'Discover pottery, floral design, culinary, coffee, and more — all bookable in seconds inside the offhrs mobile app. Track your progress and level up the skills you love.'

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Navbar />
      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 sm:px-10 sm:py-12 text-center">
          <div className="flex justify-center mb-5">
            <div className="rounded-full bg-[#5D755D]/10 p-4">
              <Smartphone className="h-10 w-10 text-[#5D755D]" />
            </div>
          </div>

          {category ? (
            <span className="inline-block text-xs font-medium px-2.5 py-1 bg-[#EDF2ED] text-[#5D755D] rounded-full mb-3 capitalize">
              {category}
            </span>
          ) : null}

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 leading-tight">
            {headline}
          </h1>
          <p className="text-gray-600 text-sm sm:text-base mb-8 max-w-xl mx-auto leading-relaxed">
            {subline}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Link
              href={APP_STORE_URL}
              className="inline-flex items-center justify-center rounded-lg bg-[#1a1a1a] text-white px-6 py-3 text-sm font-semibold hover:bg-[#333] transition-colors sm:w-[12rem]"
            >
              Download on the App Store
            </Link>
            <Link
              href={PLAY_STORE_URL}
              className="inline-flex items-center justify-center rounded-lg bg-[#1a1a1a] text-white px-6 py-3 text-sm font-semibold hover:bg-[#333] transition-colors sm:w-[12rem]"
            >
              Get it on Google Play
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-2xl mx-auto pt-6 border-t border-gray-100">
            <Feature title="Personalized" body="Get workshop picks tailored to the skills you want to level up." />
            <Feature title="Secure checkout" body="Pay with Apple Pay, Google Pay, or card — tax calculated automatically." />
            <Feature title="Your progress" body="Earn experience as you attend and level up across categories." />
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center mt-6">
          Are you a workshop host? Visit{' '}
          <Link href="/partners" className="text-[#5D755D] hover:underline font-medium">
            partners.offhrs.app
          </Link>{' '}
          to sign up and list your sessions.
        </p>

        <div className="text-center mt-8">
          <Link href="/">
            <Button variant="outline" className="rounded-full">
              Back to home
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
      <p className="text-xs text-gray-600 leading-relaxed">{body}</p>
    </div>
  )
}
