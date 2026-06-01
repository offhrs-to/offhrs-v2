import type { Metadata } from 'next'
import WorkshopsAppLanding from '@/components/workshops-app-landing'

/**
 * /workshops on the web no longer serves the consumer browse-and-book
 * experience. All consumer functionality is now exclusive to the offhrs
 * mobile app; this page exists to keep the URL alive for shared links
 * and to drive App Store / Play Store installs.
 *
 * The previous client-side listing implementation has been retired.
 * Booking APIs (`/api/book/*`) remain open because the mobile app calls
 * them; only this public web surface is gated.
 */
export const metadata: Metadata = {
  title: 'Workshops — get the offhrs app',
  description:
    'Browse and book creative workshops in the offhrs mobile app. Available on the App Store and Google Play.',
  // Keep this page out of search indexes — we no longer want Google to
  // surface a "browse workshops" page that the user can't actually use
  // to book on the web.
  robots: { index: false, follow: true },
}

export default function WorkshopsPage() {
  return <WorkshopsAppLanding />
}
