import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/legal-page-layout'

export const metadata: Metadata = {
  title: 'Terms of Use | offhrs',
  description: 'Terms of Use for offhrs.app, partners.offhrs.app, and the offhrs mobile applications.',
  alternates: { canonical: 'https://offhrs.app/terms/terms-of-use' },
}

export default function TermsOfUsePage() {
  return (
    <LegalPageLayout slug="terms-of-use">
      <section>
        <h2>Introduction</h2>
        <p>
          These are the terms and conditions of use for <strong>www.offhrs.app</strong> (the &ldquo;Terms&rdquo;)
          and all affiliated digital properties owned and operated by offhrs (&ldquo;we&rdquo;, &ldquo;us&rdquo;,
          and &ldquo;our&rdquo;), including all subdomains (such as <strong>partners.offhrs.app</strong>),
          subdirectories, mobile sites, and mobile applications deployed on the Apple App Store and Google Play
          Store (collectively, the &ldquo;Site&rdquo; or &ldquo;Platform&rdquo;).
        </p>
        <p>
          Your use of the Site is subject to these Terms. By downloading, accessing, or using the Site, you
          agree to be bound by them. These Terms govern your general access to the infrastructure of the
          Platform.
        </p>
        <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-md p-3">
          <strong>Important:</strong> These Terms <strong>do not</strong> apply to the in-person workshops,
          classes, or events themselves (the &ldquo;Vendor Services&rdquo;). Vendor Services are fulfilled
          entirely by independent third-party partners (the &ldquo;Vendors&rdquo;). offhrs acts as an
          intermediary technology platform and limited payment collection agent. We do not host, employ,
          manage, or endorse the physical workshops listed on the Platform.
        </p>
      </section>

      <section>
        <h2>1. Description of services</h2>
        <p>offhrs provides a two-sided marketplace:</p>
        <ul>
          <li>
            <strong>For consumers (students):</strong> a localized search, discovery, calendar booking, and
            payment interface to find and register for creative workshops in Toronto and surrounding areas via
            offhrs.app and the offhrs mobile apps.
          </li>
          <li>
            <strong>For vendors (makers and studios):</strong> a Software-as-a-Service (SaaS) subscription
            platform at <strong>partners.offhrs.app</strong> for managing class availability, scheduling,
            client tracking, refunds, and Stripe Connect payouts.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Tax compliance &amp; HST/GST obligations</h2>
        <p>
          As an Ontario-registered operating entity, the Platform and its users must adhere to the rules of
          the Canada Revenue Agency (CRA):
        </p>
        <ul>
          <li>
            <strong>Platform SaaS fees.</strong> offhrs charges Vendors a monthly subscription fee for our
            Partners platform, starting at <strong>$29 CAD/month (Lite)</strong> or{' '}
            <strong>$49 CAD/month (Pro)</strong>. These fees represent a taxable supply of digital services in
            Canada; we automatically add <strong>13% Ontario HST</strong> on top of the subscription price.
          </li>
          <li>
            <strong>Marketplace ticket sales.</strong> The Vendor is the &ldquo;Seller of Record&rdquo; for
            all in-person workshops. It is the sole legal responsibility of the Vendor to determine their
            small-supplier status with the CRA ($30,000 threshold) and to configure their dashboard tax
            settings to collect or omit HST on ticket sales.
          </li>
          <li>
            <strong>Tax remittance.</strong> Any HST collected from a consumer at checkout flows directly into
            the Vendor&rsquo;s connected Stripe payment account. offhrs does not hold, remit, or advise on
            municipal, provincial, or federal taxes associated with Vendor revenue.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Payments, billing, and the 30-day free trial</h2>
        <p>All financial interactions on the Platform are processed securely through Stripe.</p>

        <h3 className="mt-4">3.1 Vendor subscriptions</h3>
        <ul>
          <li>
            <strong>The trial.</strong> Vendors registering on partners.offhrs.app are granted a{' '}
            <strong>30-day free trial</strong>. Valid credit-card details are collected upon registration.
          </li>
          <li>
            <strong>Auto-renewal.</strong> On day 31, the trial automatically converts to a paid monthly
            billing cycle at your chosen plan (Lite or Pro) plus applicable HST.
          </li>
          <li>
            <strong>Cancellation.</strong> Vendors may cancel at any time from the dashboard settings.
            Cancellations must be logged prior to the renewal date to avoid the next billing increment.
          </li>
        </ul>

        <h3 className="mt-4">3.2 Ticket transactions &amp; Stripe fees</h3>
        <ul>
          <li>
            <strong>Direct payouts.</strong> Ticket payouts use a direct-charge architecture via Stripe
            Connect Express, with funds settling to the Vendor&rsquo;s connected bank account.
          </li>
          <li>
            <strong>Fee structure.</strong> Stripe processing fees (currently <strong>2.9% + $0.30 CAD</strong>{' '}
            per transaction in Canada) apply to the gross transaction total, including any tax collected.
          </li>
          <li>
            <strong>Refund window.</strong> Consumers may self-serve cancellations and refunds inside the
            mobile app or web checkout history when the workshop start time is outside the Vendor&rsquo;s
            configured refund window. The Platform minimum is <strong>24 hours</strong>; Vendors may set a
            longer window (e.g. 48 hours).
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Accounts, security, and calendar integrity</h2>
        <ul>
          <li>
            <strong>Account protection.</strong> You are responsible for maintaining the confidentiality of
            your sign-in credentials and any third-party OAuth sessions (Google, Apple). Notify us immediately
            at <a href="mailto:admin@offhrs.app">admin@offhrs.app</a> if you detect unauthorized access.
          </li>
          <li>
            <strong>Calendar accuracy.</strong> Vendors must keep their dashboard calendars up to date.
            Deliberate manipulation, double-booking negligence, or repeated failure to honour confirmed
            bookings constitutes a material breach of these Terms and may result in subscription termination.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Prohibited conduct</h2>
        <p>Except as expressly permitted by these Terms, you are strictly prohibited from:</p>
        <ul>
          <li>
            <strong>Data scraping.</strong> Using automated programs, scripts, crawlers, or spiders to harvest
            studio schedules, pricing, metadata, or reviews from offhrs.app.
          </li>
          <li>
            <strong>Reverse engineering.</strong> Attempting to decompile, clone, or reverse-engineer our
            scheduling engine, database schemas, or application code to build a competing marketplace or
            scheduling utility.
          </li>
          <li>
            <strong>Bypassing the platform.</strong> Using the discovery features to source students and
            coordinate bookings off-platform to avoid platform fees.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Disclaimers &amp; limitation of liability</h2>
        <ul>
          <li>
            <strong>As-is.</strong> The Platform is provided on an &ldquo;as-is&rdquo; and
            &ldquo;as-available&rdquo; basis. We do not guarantee uninterrupted, latency-free operation or
            absolute uptime.
          </li>
          <li>
            <strong>Physical event liability.</strong> offhrs has zero liability for property damage, personal
            injury, health conditions, or unmet expectations arising during an in-person workshop hosted by a
            Vendor. Any disputes regarding workshop quality, safety, materials, or studio facilities must be
            settled directly between the student and the Vendor.
          </li>
          <li>
            <strong>Financial limitations.</strong> To the maximum extent permitted by applicable law in the
            Province of Ontario, our total aggregate liability for any claim arising under these Terms is
            strictly limited to the actual subscription amounts (excluding ticket pass-through) paid by you to
            offhrs over the three (3) months immediately preceding the claim.
          </li>
          <li>
            <strong>Consumer rights.</strong> Nothing in these Terms is intended to exclude or limit rights
            that applicable law does not allow to be excluded or limited.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Governing law and jurisdiction</h2>
        <p>
          These Terms, your access to the Platform on the Apple and Google Play networks, and any disputes
          arising out of the Platform shall be governed by the laws of the Province of Ontario and the federal
          laws of Canada applicable therein. Any formal mediation or legal proceedings must be initiated and
          resolved within the judicial district of Toronto, Ontario.
        </p>
      </section>

      <section>
        <h2>8. Feedback and communications</h2>
        <p>
          Submit formal questions, security notifications, or technical feedback to{' '}
          <a href="mailto:admin@offhrs.app">admin@offhrs.app</a>.
        </p>
      </section>
    </LegalPageLayout>
  )
}
