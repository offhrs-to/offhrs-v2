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
          <strong>Important:</strong> These Terms <strong>do not</strong> make offhrs the provider of
          in-person workshops or the seller of physical Marketplace goods. Workshops and Marketplace goods
          (together, &ldquo;Vendor Services&rdquo;) are fulfilled by independent third-party partners (the
          &ldquo;Vendors&rdquo;). offhrs acts as an intermediary technology platform and limited payment
          collection agent. We do not host, employ, warehouse, or ship Vendor Services.
        </p>
      </section>

      <section>
        <h2>1. Description of services</h2>
        <p>offhrs provides a two-sided marketplace:</p>
        <ul>
          <li>
            <strong>For consumers:</strong> discovery, booking, and payment for creative workshops in Toronto
            and surrounding areas, and (where available) purchase of physical art and craft goods through the
            Artist Marketplace via offhrs.app and the offhrs mobile apps.
          </li>
          <li>
            <strong>For vendors (makers and studios):</strong> a Partners dashboard at{' '}
            <strong>partners.offhrs.app</strong> for workshop SaaS tools (Lite/Pro), optional Shopify Sync,
            and/or Artist Marketplace selling (included with Lite/Pro, or via a free Marketplace-only
            enrollment), including Stripe Connect payouts.
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
            <strong>Workshop ticket sales.</strong> The Vendor is the &ldquo;Seller of Record&rdquo; for
            in-person workshops. Vendors must determine their CRA small-supplier status and configure
            workshop tax settings appropriately.
          </li>
          <li>
            <strong>Artist Marketplace goods.</strong> The Vendor is the Seller of Record for physical goods.
            Where CRA marketplace facilitator rules apply, offhrs may calculate, collect, and remit applicable
            GST/HST on Marketplace sales via Stripe Tax on the platform account (facilitator tax is not paid out
            as Vendor merchandise earnings). Workshop ticket tax handling may differ; see your dashboard
            settings and the Marketplace Seller Addendum.
          </li>
          <li>
            <strong>Tax remittance (workshops).</strong> Where workshop HST is collected into the
            Vendor&rsquo;s Stripe Connect account under the Vendor&rsquo;s registration settings, remittance
            remains the Vendor&rsquo;s responsibility unless we notify you otherwise in writing.
          </li>
          <li>
            <strong>Tax remittance (Marketplace).</strong> Facilitator GST/HST collected on Marketplace goods
            is remitted by offhrs under applicable CRA rules once registration and processes are in place;
            Vendors remain responsible for their own income tax and any non-facilitated tax obligations.
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

        <h3 className="mt-4">3.2 Ticket and Marketplace transactions &amp; fees</h3>
        <ul>
          <li>
            <strong>Direct payouts.</strong> Workshop and Marketplace payouts use Stripe Connect Express
            destination charges, with funds settling to the Vendor&rsquo;s connected bank account. For
            Marketplace orders, buyer-paid shipping (and any seller handling fee collected as shipping) and
            applicable facilitator tax are held on the platform so they are not paid out as Vendor merchandise
            earnings; shipping funds prepaid Canada Post labels purchased via Shippo.
          </li>
          <li>
            <strong>Workshop fee structure.</strong> For workshop bookings, offhrs does{' '}
            <strong>not</strong> take a percentage commission. Stripe processing fees (currently about{' '}
            <strong>2.9% + $0.30 CAD</strong> per transaction in Canada) apply to the gross total and are
            borne by the Vendor.
          </li>
          <li>
            <strong>Marketplace fee structure.</strong> For Artist Marketplace sales, offhrs charges a{' '}
            <strong>5% platform fee</strong> on the item subtotal (excluding tax and shipping postage),{' '}
            <strong>plus</strong> Stripe processing fees (about <strong>2.9% + $0.30 CAD</strong>), which are
            separate and also borne by the Vendor. Platform fee, estimated Stripe processing (when applicable),
            shipping collected, and facilitator tax may be collected via Stripe application fees on the payment.
          </li>
          <li>
            <strong>Workshop refund window.</strong> Consumers may self-serve cancellations and refunds inside the
            mobile app or web checkout history when the workshop start time is outside the Vendor&rsquo;s
            configured refund window. The Platform minimum is <strong>24 hours</strong>; Vendors may set a
            longer window (e.g. 48 hours).
          </li>
          <li>
            <strong>Marketplace cancellations.</strong> Marketplace orders may be refunded before carrier First
            Scan (or before pickup completion) when permitted by the Platform and carrier void rules. After First
            Scan, order cancellation via the Platform is blocked; damaged / not-as-described issues follow the
            Marketplace Seller Addendum claim rules.
          </li>
          <li>
            <strong>Refund fees.</strong> Stripe does not return its processing fee when a charge is
            refunded. When a booking or eligible Marketplace order is refunded, the consumer receives the full amount paid (including
            applicable tax) back to their original payment method, and the non-refundable Stripe processing fee
            remains the <strong>Vendor&rsquo;s responsibility</strong> unless we state otherwise. The fee is netted against the
            reversed payout in the Vendor&rsquo;s Stripe Connect Express balance where applicable.
          </li>
        </ul>

        <h3 className="mt-4">3.3 Chargebacks and payment disputes (Vendors)</h3>
        <p>
          Payments for workshop bookings and Marketplace orders are processed through Stripe Connect to your
          connected account. You are the seller of record for those sales.
        </p>
        <ul>
          <li>
            Chargebacks and payment disputes relating to your workshops, Marketplace orders, or Partner
            subscription may result in deductions from your Connect balance or future payouts, including the
            full disputed amount, Stripe dispute fees (currently about <strong>CAD $15</strong> per dispute,
            subject to change by Stripe), and reasonable costs offhrs incurs in connection with the dispute.
          </li>
          <li>
            You authorize offhrs to debit or offset such amounts from your Stripe Connect Express account,
            future payouts, or by invoice if your balance is insufficient, including via transfer reversal where
            available. You agree to cooperate promptly
            with evidence requests (for Marketplace orders, this includes shipping labels, tracking, and proof
            of packing or pickup where relevant). Marketplace carrier postage adjustments (APV) may likewise be
            debited.
          </li>
          <li>
            offhrs is not responsible for chargebacks arising from your conduct, inaccurate listings, failure
            to deliver a workshop as described, failure to ship or make Marketplace goods available for pickup
            as represented, or your refund and return practices. Abnormal chargeback rates may lead to
            suspension or termination of Partner or Marketplace access.
          </li>
          <li>
            We encourage resolving issues through in-app flows or{' '}
            <a href="mailto:hello@offhrs.app">hello@offhrs.app</a> before a card dispute is filed.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Accounts, security, and calendar integrity</h2>
        <ul>
          <li>
            <strong>Account protection.</strong> You are responsible for maintaining the confidentiality of
            your sign-in credentials and any third-party OAuth sessions (Google, Apple). Notify us immediately
            at <a href="mailto:hello@offhrs.app">hello@offhrs.app</a> if you detect unauthorized access.
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
          <a href="mailto:hello@offhrs.app">hello@offhrs.app</a>.
        </p>
      </section>
    </LegalPageLayout>
  )
}
