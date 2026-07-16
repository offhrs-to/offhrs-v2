import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/legal-page-layout'

export const metadata: Metadata = {
  title: 'Privacy Policy | offhrs',
  description:
    'How offhrs collects, uses, and safeguards your personal information across offhrs.app, partners.offhrs.app, and our mobile apps.',
  alternates: { canonical: 'https://offhrs.app/terms/privacy-policy' },
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout slug="privacy-policy">
      <section>
        <h2>Introduction</h2>
        <p>
          At offhrs (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), we are committed to protecting
          the privacy and security of our users. For the purposes of the{' '}
          <strong>Personal Information Protection and Electronic Documents Act (PIPEDA)</strong> and
          applicable Canadian privacy legislation, offhrs acts as the data custodian and controller for
          information collected through our ecosystem.
        </p>
        <p>
          This Privacy Policy (&ldquo;Notice&rdquo;) outlines how we collect, manage, use, and safeguard
          personal data across the website <strong>offhrs.app</strong>, the vendor portal{' '}
          <strong>partners.offhrs.app</strong>, and our official mobile applications on the Apple App Store
          and Google Play Store (collectively, the &ldquo;Services&rdquo;).
        </p>
        <p>
          If you have any questions or wish to exercise your data rights, contact us at{' '}
          <a href="mailto:hello@offhrs.app">hello@offhrs.app</a>.
        </p>
      </section>

      <section>
        <h2>1. Scope of this notice</h2>
        <p>This Notice applies to the following individuals interacting with the Services:</p>
        <ul>
          <li>
            <strong>Consumers (students/bookers):</strong> individuals who browse the app, create profiles, and
            book creative workshops.
          </li>
          <li>
            <strong>Vendors (makers/studio owners):</strong> solo entrepreneurs, instructors, or businesses
            who subscribe to our SaaS tier (Lite or Pro) to host classes and manage scheduling.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Information we collect &amp; how we use it</h2>

        <h3 className="mt-4">2.1 Technical and device infrastructure data</h3>
        <p>
          Whenever you interact with offhrs.app or partners.offhrs.app we automatically log network data to
          ensure application performance and prevent fraud:
        </p>
        <ul>
          <li>
            <strong>What we collect:</strong> IP addresses, device hardware signatures, operating-system
            versions, browser types, session interaction telemetry, and cookie tokens.
          </li>
          <li>
            <strong>Approximate location.</strong> If you choose to share it, we may store a Canadian postal
            code and/or coarse latitude/longitude derived from your device or from geocoding that postal
            code, so we can show and sort workshops by distance. This is optional and is not used for
            advertising or sold to third parties.
          </li>
          <li>
            <strong>Lawful basis:</strong> legitimate interests (platform stability, security, and
            performance).
          </li>
        </ul>

        <h3 className="mt-4">2.2 Account and profile records</h3>
        <ul>
          <li>
            <strong>Consumers:</strong> name, email, optional mobile number, postal code, and tokenized
            payment references (we never store full card numbers).
          </li>
          <li>
            <strong>Vendors:</strong> during signup on partners.offhrs.app, we collect business name, business
            email, contact details, address, and the verification information Stripe Connect requires for
            payouts (tax ID, banking).
          </li>
          <li>
            <strong>Lawful basis:</strong> performance of a contract (to operate your account and fulfil a
            booking).
          </li>
        </ul>

        <h3 className="mt-4">2.3 Booking and scheduling data</h3>
        <ul>
          <li>
            <strong>What we process:</strong> workshop timestamps, capacity, slot availability, booking
            history, attendance, cancellations, and refund records.
          </li>
          <li>
            <strong>Data flow:</strong> we render open slots to consumers based on the Vendor&rsquo;s
            published schedule and the active bookings in the system. Slot counts are reconciled
            automatically when bookings, refunds, or account deletions occur.
          </li>
          <li>
            <strong>Lawful basis:</strong> performance of a contract &amp; legitimate interests (preventing
            scheduling conflicts).
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Data sharing and marketplace architecture</h2>
        <p>offhrs is a marketplace facilitator. To complete transactions, your data flows along specific paths:</p>
        <ul>
          <li>
            <strong>Between consumer and vendor.</strong> When a student purchases a workshop ticket, their
            name, contact number (if provided), and email are shared with the hosting Vendor so the studio
            can coordinate materials and communicate logistics.
          </li>
          <li>
            <strong>Sensitive data note.</strong> If a Vendor requests health or accommodation information via
            their own intake forms (e.g. allergies in a cooking class), the Vendor is the sole data
            controller for that sensitive information. offhrs is not the controller for off-platform forms.
          </li>
          <li>
            <strong>No selling of personal data.</strong> offhrs does not sell, lease, or trade your phone
            number, email, or reviews to third-party data brokers or external marketing lists.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Service providers we use</h2>
        <p>We share data only as needed to run the Services:</p>
        <ul>
          <li>
            <strong>Supabase</strong> &mdash; authentication and database hosting.
          </li>
          <li>
            <strong>Stripe &amp; Stripe Connect Express</strong> &mdash; processing payments for workshop
            tickets and the monthly Vendor SaaS subscription, and routing Vendor payouts.{' '}
            <strong>We never store raw credit card numbers or CVV codes.</strong> We retain only tokenized
            references provided by Stripe (card brand, last four digits, expiry).
          </li>
          <li>
            <strong>Resend</strong> &mdash; sending transactional emails (booking confirmations, refund
            notices, account alerts) and any marketing emails you have explicitly agreed to receive.
          </li>
          <li>
            <strong>Vercel</strong> &mdash; web hosting and edge delivery for offhrs.app and
            partners.offhrs.app.
          </li>
          <li>
            <strong>Expo / Apple / Google</strong> &mdash; mobile app distribution and over-the-air updates.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Data retention</h2>
        <ul>
          <li>
            <strong>Active accounts.</strong> Profile settings, calendar structures, and workshop history are
            retained for the lifecycle of your active registration.
          </li>
          <li>
            <strong>Account deletion.</strong> When you delete your account from the mobile Profile screen,
            we immediately remove your profile, saves, reviews, and active bookings from production
            databases. Affected workshop slots are reconciled so partners see accurate availability.
          </li>
          <li>
            <strong>CRA retention.</strong> Transaction logs, HST billing records, and Stripe settlement
            records are retained securely for up to <strong>six (6) years</strong> to satisfy Canada Revenue
            Agency audit requirements.
          </li>
          <li>
            <strong>Anonymized telemetry.</strong> Aggregated platform telemetry stripped of personally
            identifiable information may be retained indefinitely.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Your Canadian privacy rights</h2>
        <p>Under PIPEDA you have:</p>
        <ul>
          <li>
            <strong>Right of access.</strong> Request an export of your profile and booking history at{' '}
            <a href="mailto:hello@offhrs.app">hello@offhrs.app</a>.
          </li>
          <li>
            <strong>Right of rectification.</strong> Correct inaccurate records or update tax/postal-code
            settings at any time in the app.
          </li>
          <li>
            <strong>Right of erasure.</strong> Request permanent deletion of your account. We purge personal
            information from production within 30 days, keeping only what is required for tax audit
            validation (see section 5).
          </li>
          <li>
            <strong>Right to complain.</strong> If you are not satisfied with our response, you may contact
            the Office of the Privacy Commissioner of Canada (OPC).
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Security and international transfer</h2>
        <p>
          We use industry-standard measures to protect your data, including TLS encryption in transit and Row
          Level Security on the Supabase backend. Our providers may process data in the United States or
          other countries; we rely on appropriate safeguards (such as standard contractual clauses) where
          required.
        </p>
      </section>

      <section>
        <h2>8. Revisions to this notice</h2>
        <p>
          We may modify this Notice as our product evolves. Any changes will be posted on this page with an
          updated timestamp. For significant changes impacting user tracking or data flows, we will push an
          alert or a mandatory update confirmation inside our mobile applications.
        </p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>
          For privacy requests or questions, email{' '}
          <a href="mailto:hello@offhrs.app">hello@offhrs.app</a>.
        </p>
      </section>
    </LegalPageLayout>
  )
}
