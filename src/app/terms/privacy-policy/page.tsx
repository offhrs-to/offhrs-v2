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
            <strong>Consumers (students/bookers and Marketplace buyers):</strong> individuals who browse the
            app, create profiles, book creative workshops, and buy Marketplace goods.
          </li>
          <li>
            <strong>Vendors (makers/studio owners):</strong> solo entrepreneurs, instructors, or businesses
            who use our Partners tools (a workshop plan such as Lite or Pro, Shopify Sync,
            and/or the Artist Marketplace) to host classes, sell goods, and manage scheduling and orders.
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
            code, so we can show and sort workshops by distance. This is optional and is not sold to third
            parties. It is separate from Meta advertising cookies described below.
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
            email, contact details, address (including a Canadian ship-from or pickup address if you sell
            Marketplace goods), your GST/HST registration status, and the verification information Stripe
            Connect requires for payouts (tax ID, banking).
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

        <h3 className="mt-4">2.4 Marketplace order data</h3>
        <ul>
          <li>
            <strong>What we process:</strong> when you buy Marketplace goods, your name, email, optional
            phone, shipping address (or pickup details), order contents and amounts, tax calculated on the
            order, payment references from Stripe, shipping labels and tracking, and any damaged /
            not-as-described claim you submit (including descriptions and photo links).
          </li>
          <li>
            <strong>Why:</strong> to process payment and tax, enable the Vendor to fulfill the order, ship
            and track it, handle refunds, claims, and chargebacks, prevent fraud, and meet legal and tax
            record-keeping duties.
          </li>
        </ul>

        <h3 className="mt-4">2.5 Shopify Sync data (Vendors)</h3>
        <ul>
          <li>
            <strong>What we process:</strong> if you install the offhrs Sync app from Shopify, we process your
            shop domain, your product, inventory, and product-listing information (such as titles,
            descriptions, images, prices, and availability), and your Shopify billing status.
          </li>
          <li>
            <strong>What we do not request:</strong> access to your Shopify customer or order data. Shopify
            may send us data-request or deletion notices under its program requirements, and we handle them as
            required.
          </li>
          <li>
            <strong>Why:</strong> to create and update your workshop listings on offhrs and to manage your
            Shopify Sync subscription. If you uninstall the app, we stop syncing and remove or archive the
            synced listings.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Data sharing and marketplace architecture</h2>
        <p>offhrs is a marketplace facilitator. To complete transactions, your data flows along specific paths:</p>
        <ul>
          <li>
            <strong>Between consumer and vendor (workshops).</strong> When a student purchases a workshop
            ticket, their name, contact number (if provided), and email are shared with the hosting Vendor so
            the studio can coordinate materials and communicate logistics.
          </li>
          <li>
            <strong>Between consumer and vendor (Marketplace).</strong> When you purchase Marketplace goods,
            your shipping name, address, phone (if provided), and email are shared with the Vendor solely to
            fulfill the order (print a shipping label or coordinate pickup) or respond to an order claim. Vendors
            must not use that data for off-platform marketing without your explicit opt-in.
          </li>
          <li>
            <strong>Marketplace claims.</strong> If you submit a damaged / not-as-described claim, we process
            your description and any photo links you provide so we and the Vendor can investigate. Claim records
            are retained with the order for support and compliance.
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
            <strong>Stripe, Stripe Connect Express &amp; Stripe Tax</strong> &mdash; processing payments for
            workshop tickets, Marketplace goods, and the monthly Vendor SaaS subscription, calculating tax on
            Marketplace orders (using the shipping or pickup address), and routing Vendor payouts.{' '}
            <strong>We never store raw credit card numbers or CVV codes.</strong> We retain only tokenized
            references provided by Stripe (card brand, last four digits, expiry).
          </li>
          <li>
            <strong>Shippo</strong> &mdash; when you buy Marketplace goods, we use Shippo to obtain Canada
            Post rates, purchase prepaid labels, and receive tracking updates. Address and parcel details are
            shared with Shippo and the carrier (Canada Post) as needed to generate labels and deliver the
            order.
          </li>
          <li>
            <strong>Shopify</strong> &mdash; if you are a Vendor who uses Shopify Sync, we receive Shopify Data
            from your store and Shopify bills the Shopify Sync subscription (see section 2.5).
          </li>
          <li>
            <strong>Resend</strong> &mdash; sending transactional emails (booking confirmations, order and
            shipping notices, refund and dispute notices, account alerts) and any marketing emails you have
            explicitly agreed to receive.
          </li>
          <li>
            <strong>Vercel</strong> &mdash; web hosting and edge delivery for offhrs.app and
            partners.offhrs.app.
          </li>
          <li>
            <strong>Expo / Apple / Google</strong> &mdash; mobile app distribution and over-the-air updates
            (Google here means the Play Store / Expo tooling, not Google Analytics).
          </li>
          <li>
            <strong>Meta Platforms (Facebook / Instagram)</strong> &mdash; if you accept advertising cookies
            on offhrs.app, we load the Meta Pixel so Meta can help us measure and optimize ads we run in Meta
            Ads Manager (including Instagram). Meta may receive browser identifiers and page-view or
            conversion events (for example, a Lead event when someone opens an external workshop booking
            link). We do not use Google Analytics, Google Ads tags, or Meta&rsquo;s server-side Conversions
            API. See our{' '}
            <a href="/terms/cookies">Cookie Policy</a> for cookie names and how to decline.
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
            we remove your profile, saves, and reviews from production databases. Active workshop bookings
            are refunded and those booking records are anonymized. Affected workshop slots are reconciled so
            partners see accurate availability.
          </li>
          <li>
            <strong>Marketplace orders.</strong> Unshipped Marketplace orders are refunded, then anonymized.
            Orders that are awaiting pickup, in transit, inside the 14-day delivery claim window, or under an
            open claim or payment dispute temporarily block account deletion until that order is finished
            (we show a clear message in the app). Finished, quiet orders are anonymized (name, email, and
            shipping address removed) while payment, tax, and order amounts are kept for up to{' '}
            <strong>six (6) years</strong> for tax, audit, and dispute purposes. Contact{' '}
            <a href="mailto:hello@offhrs.app">hello@offhrs.app</a> if you need help completing deletion.
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
