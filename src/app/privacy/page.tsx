import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Link href="/" className="inline-block text-sm text-gray-500 hover:text-gray-700 mb-6">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: March 2025</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-lg font-semibold text-gray-900">1. Data we collect</h2>
            <p>
              We collect and process the following data when you use Offhrs: (a) <strong>Account data</strong> — email,
              name, and profile details you provide when signing up or in your profile; (b) <strong>Usage data</strong> —
              workshops you book, attendance confirmations, saved vendors, and reviews; (c){' '}
              <strong>Approximate location for convenience</strong> — if you choose to share it, we may store a Canadian
              postal code and/or latitude and longitude derived from your device location or from geocoding that postal
              code, so we can show and sort workshops by distance. This is optional; (d) <strong>Technical data</strong>{' '}
              — such as IP address and device information where necessary for security and operation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">2. How we use your data</h2>
            <p>
              We use your data to provide the service (workshop discovery, booking, and experience tracking), to send
              you transactional emails (e.g. booking confirmations), to improve the product, and to comply with legal
              obligations. If you provide a postal code or device location, we use that information only to estimate
              distance to listed workshops and to order results for your convenience — not for advertising profiles,
              continuous background tracking, or sale to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">3. Who we share data with</h2>
            <p>
              We share data only as needed to run the service: (a) <strong>Supabase</strong> — authentication and
              database (hosted in the cloud); (b) <strong>Resend</strong> — for sending emails; (c) <strong>Analytics or
              hosting providers</strong> — where we use them, under strict data processing terms. We do not sell your
              personal data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">4. How long we keep data</h2>
            <p>
              We keep your account and profile data until you delete your account. Booking and review data are retained
              as long as your account is active. After account deletion, we remove or anonymize your data as described
              in the “Your rights” section.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">5. Your rights</h2>
            <p>
              You can request access to your data, correction of inaccuracies, or deletion of your account at any time.
              To delete your account, use the “Delete my account” option in your Profile, or contact us at the email
              below. We will delete your account and associated data (profile, bookings, saves, reviews) from our
              systems. Some data may be retained where required by law (e.g. tax or legal hold). You can update or clear
              your saved postal code and location at any time in the app’s Profile settings; clearing it removes those
              values from your profile. You can also revoke location permission in your device settings at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">6. Security and international transfer</h2>
            <p>
              We use industry-standard measures to protect your data. Our providers may process data in the United
              States or other countries; we ensure appropriate safeguards (e.g. standard contractual clauses) where
              required.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">7. Contact</h2>
            <p>
              For privacy requests or questions, contact us at the support email listed in the app or on our website.
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <Link href="/">
            <Button variant="outline">Back to home</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
