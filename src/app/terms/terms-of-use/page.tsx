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
        <p>
          Vendors also accept these Terms (and, as applicable, the Marketplace Seller Addendum) when they
          create a Partners account, enable the Artist Marketplace, publish a Marketplace product, connect
          Stripe for payouts, or install or connect the offhrs Sync app from Shopify. If there is a conflict
          between documents, the Data Protection Addendum prevails for data-handling matters and the
          Marketplace Seller Addendum prevails for the sale of Marketplace goods.
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
            <strong>partners.offhrs.app</strong> for workshop SaaS tools (Lite / Pro / Full License), optional Shopify Sync
            (see Section 3.4), and/or Artist Marketplace selling (included with Pro / Full License, or via a free Marketplace-only
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
            <strong>Platform SaaS fees.</strong> offhrs offers a free Marketplace Only plan and paid Partners
            plans: <strong>$29 CAD/month (Lite)</strong>, <strong>$29 CAD/month (Shopify Sync)</strong>,{' '}
            <strong>$39 CAD/month (Pro)</strong>, or <strong>$59 CAD/month (Full License)</strong>. Paid
            subscription fees represent a taxable supply of digital services in Canada; we automatically add{' '}
            <strong>13% Ontario HST</strong> on top of Stripe-billed subscription prices. Shopify Sync is billed
            by Shopify through Shopify App Pricing (not by Stripe), and any taxes on those charges are applied
            by Shopify as shown in your Shopify billing.
          </li>
          <li>
            <strong>Workshop ticket sales.</strong> The Vendor is the &ldquo;Seller of Record&rdquo; for
            in-person workshops. Vendors must determine their CRA small-supplier status and configure
            workshop tax settings appropriately.
          </li>
          <li>
            <strong>Artist Marketplace goods.</strong> The Vendor is the Seller of Record for physical goods.
            Where the CRA digital-economy rules for distribution platform operators apply to offhrs
            (generally, for goods supplied by Vendors who are not registered for GST/HST), offhrs may
            calculate, collect, and remit applicable GST/HST on Marketplace sales via Stripe Tax on the
            platform account (facilitator tax is not paid out as Vendor merchandise earnings). Vendors who are
            registered for GST/HST remain responsible for their own GST/HST obligations on Marketplace sales
            under the <em>Excise Tax Act</em> (Canada), and offhrs may adjust how tax is calculated, collected,
            and allocated (including payouts) as CRA requirements apply. You must keep your GST/HST
            registration status and number in your dashboard tax settings accurate and up to date. Workshop
            ticket tax handling may differ; see your dashboard settings and the Marketplace Seller Addendum.
            offhrs does not provide tax advice; obtain your own.
          </li>
          <li>
            <strong>Tax remittance (workshops).</strong> Where workshop HST is collected into the
            Vendor&rsquo;s Stripe Connect account under the Vendor&rsquo;s registration settings, remittance
            remains the Vendor&rsquo;s responsibility unless we notify you otherwise in writing.
          </li>
          <li>
            <strong>Tax remittance (Marketplace).</strong> Facilitator GST/HST that offhrs collects on
            Marketplace goods is remitted by offhrs under applicable CRA rules; Vendors remain responsible
            for their own income tax and any tax obligations that offhrs does not collect or remit.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Payments, billing, and the 30-day free trial</h2>
        <p>All financial interactions on the Platform are processed securely through Stripe.</p>

        <h3 className="mt-4">3.1 Vendor subscriptions</h3>
        <ul>
          <li>
            <strong>The trial.</strong> Vendors registering on partners.offhrs.app for a Stripe-billed plan
            (Lite, Pro, or Full License) are granted a <strong>30-day free trial</strong>. Valid credit-card
            details are collected upon registration. Marketplace Only has no subscription fee or trial. Shopify
            Sync includes a 30-day free trial that is administered by Shopify (see Section 3.4).
          </li>
          <li>
            <strong>Auto-renewal.</strong> On day 31, the trial of a Stripe-billed plan automatically converts
            to a paid monthly billing cycle at your chosen plan (Lite, Pro, or Full License) plus applicable
            HST.
          </li>
          <li>
            <strong>Cancellation.</strong> Vendors may cancel a Stripe-billed plan at any time from the
            dashboard settings. Cancellations must be logged prior to the renewal date to avoid the next
            billing increment. Shopify Sync is cancelled through Shopify (including by uninstalling the app).
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

        <h3 className="mt-4">3.4 Shopify Sync (offhrs Sync app)</h3>
        <ul>
          <li>
            <strong>What it does.</strong> Shopify Sync is an optional app that you install from Shopify. With
            your authorization, it reads product, inventory, and product-listing information from your Shopify
            store (&ldquo;Shopify Data&rdquo;) and uses it to create and update your workshop listings on
            offhrs. It is a read-only connection: offhrs does not edit your Shopify products, prices,
            inventory, orders, or customers, and does not request access to your Shopify customer or order
            data. The app may send status feedback to Shopify about the sync. It supports Canada / CAD stores.
          </li>
          <li>
            <strong>Bookings on your Shopify store.</strong> Consumers who select a synced listing complete
            booking and payment on your Shopify checkout. You are the Seller of Record and the contracting
            party for those sales. offhrs does not process payment for them, is not a party to them, and
            takes <strong>no commission</strong> on them. You are solely responsible for pricing, taxes,
            refunds, inventory accuracy, fulfilment, customer service, and your compliance with Shopify&rsquo;s
            terms and applicable law for those sales.
          </li>
          <li>
            <strong>Fees and billing.</strong> After a 30-day free trial, Shopify Sync costs{' '}
            <strong>$29 CAD per 30-day billing cycle</strong>, billed by Shopify through Shopify App Pricing.
            Shopify&rsquo;s terms and billing practices govern those charges, including refunds and
            credits. Cancel by cancelling the subscription or uninstalling the app in your Shopify admin.
          </li>
          <li>
            <strong>Accuracy and rights.</strong> Shopify Data that is published on offhrs is Vendor content
            (see Section 7) and is subject to the Content Policy. Syncing may be delayed, incomplete, or
            interrupted (for example, because of changes to Shopify&rsquo;s systems), and offhrs may hide or
            remove any synced listing that is inaccurate, expired, or in breach of our policies.
          </li>
          <li>
            <strong>Uninstall and termination.</strong> If you uninstall the app, Shopify cancels your
            subscription, or your store is otherwise disconnected, offhrs will stop syncing, disconnect your
            store, and remove or archive the synced listings from public browse. We handle Shopify&rsquo;s
            data-deletion requests as required by Shopify&rsquo;s program requirements.
          </li>
          <li>
            <strong>Independence.</strong> Shopify is a trademark of Shopify Inc. offhrs is independent of,
            and is not endorsed or sponsored by, Shopify. Shopify is a third-party service; offhrs is not
            responsible for its availability, acts, or omissions.
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
            <strong>Bypassing the platform.</strong> Using the discovery features to source students or
            Marketplace buyers and coordinate bookings or purchases off-platform to avoid fees payable under
            these Terms (including the Marketplace platform fee). This does not restrict listings that
            link to your own checkout, such as Shopify Sync listings, which are permitted features of the
            Platform.
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
            <strong>Marketplace goods.</strong> offhrs does not make, own, inspect, store, or ship Marketplace
            goods. offhrs has no liability for the quality, safety, legality, authenticity, description, or
            condition of goods sold by Vendors, or for delay, loss, or damage in carrier transit, except as
            expressly set out in the Marketplace Seller Addendum and the Service Terms claim process. Those
            matters are between the buyer, the Vendor, and (for transit) the carrier.
          </li>
          <li>
            <strong>Third-party services.</strong> The Platform relies on third-party services (including
            Stripe, Shippo, Canada Post, Shopify, and our hosting and email providers). offhrs is not
            responsible for their availability, acts, or omissions. Vendors must comply with the terms of the
            third-party services they use through the Platform, including Stripe&rsquo;s Connected Account
            Agreement and, for Shopify Sync, Shopify&rsquo;s terms.
          </li>
          <li>
            <strong>Financial limitations.</strong> To the maximum extent permitted by applicable law in the
            Province of Ontario, our total aggregate liability for any claim arising under these Terms is
            limited to the greater of (a) the fees paid by you to offhrs (subscription fees and Marketplace
            platform fees, excluding ticket, goods, shipping, and tax pass-through amounts) over the three (3)
            months immediately preceding the claim, and (b) CAD $100. offhrs is not liable for indirect,
            incidental, special, consequential, or punitive damages, or for lost profits, revenue, or data.
            These limits do not apply to liability for our own fraud, gross negligence, or wilful misconduct.
          </li>
          <li>
            <strong>Consumer rights.</strong> Nothing in these Terms is intended to exclude or limit rights
            that applicable law does not allow to be excluded or limited, including rights under the{' '}
            <em>Consumer Protection Act, 2002</em> (Ontario).
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Vendor content, licence, and indemnity</h2>
        <ul>
          <li>
            <strong>Your content.</strong> You keep ownership of the listing content you provide or sync
            (including titles, descriptions, photos, prices, inventory data, logos, and business details). You
            represent that you have all rights needed to provide it and that it is accurate and lawful.
          </li>
          <li>
            <strong>Licence to offhrs.</strong> You grant offhrs a non-exclusive, worldwide, royalty-free
            licence to host, reproduce, resize, adapt for format, display, and distribute that content in
            connection with operating, securing, and promoting the Platform, including in the web and mobile
            apps and in offhrs marketing and social channels that feature your listings. This licence ends
            when you remove the content or close your account, except for copies in backups, order records,
            and legal records that we must or may retain.
          </li>
          <li>
            <strong>Vendor indemnity.</strong> You will defend, indemnify, and hold harmless offhrs and its
            directors, officers, employees, and agents from third-party claims, and related losses, liabilities,
            costs, and reasonable legal fees, arising from: (a) your workshops or Marketplace goods (including
            product safety, defects, recalls, labelling, and infringement of intellectual property); (b) your
            listing content or Shopify Data; (c) your breach of these Terms, the Marketplace Seller Addendum,
            or the Content Policy; (d) your tax obligations; or (e) your dealings with consumers or buyers.
          </li>
        </ul>
      </section>

      <section>
        <h2>8. Governing law and jurisdiction</h2>
        <p>
          These Terms, your access to the Platform on the Apple and Google Play networks, and any disputes
          arising out of the Platform shall be governed by the laws of the Province of Ontario and the federal
          laws of Canada applicable therein. Any formal mediation or legal proceedings must be initiated and
          resolved within the judicial district of Toronto, Ontario.
        </p>
      </section>

      <section>
        <h2>9. Changes, feedback, and communications</h2>
        <p>
          We may update these Terms as our services and legal requirements change. We will post the updated
          Terms with a revised &ldquo;Last updated&rdquo; date and will give reasonable advance notice of
          material changes (for example, by email or a notice in the app or Partners dashboard). If you do not
          agree to a change, you may stop using the Platform and cancel your plan before it takes effect;
          continuing to use the Platform afterwards means you accept the updated Terms.
        </p>
        <p>
          Submit formal questions, security notifications, or technical feedback to{' '}
          <a href="mailto:hello@offhrs.app">hello@offhrs.app</a>.
        </p>
      </section>
    </LegalPageLayout>
  )
}
