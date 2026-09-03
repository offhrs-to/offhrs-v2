import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/legal-page-layout'

export const metadata: Metadata = {
  title: 'Service Terms | offhrs',
  description:
    'Service Terms governing your booking relationship with offhrs and the independent vendors hosting workshops.',
  alternates: { canonical: 'https://offhrs.app/terms/service-terms' },
}

export default function ServiceTermsPage() {
  return (
    <LegalPageLayout slug="service-terms">
      <section>
        <h2>Welcome to offhrs &mdash; summary of key terms</h2>
        <p>We have worked hard to keep our Service Terms clear and straightforward. In short:</p>
        <ul>
          <li>
            <strong>The platform.</strong> offhrs provides a localized discovery application (offhrs.app) and
            a vendor portal (partners.offhrs.app) for in-person creative workshops in Toronto and surrounding
            areas, and (where available) for purchasing physical art and craft goods through the Artist
            Marketplace.
          </li>
          <li>
            <strong>Our intermediary role.</strong> Workshops and Marketplace goods are owned, fulfilled, and
            operated by independent third-party partners (&ldquo;Vendors&rdquo;) &mdash; not by us. offhrs
            acts as a technology intermediary and limited commercial payment collection agent. We do not
            warehouse or ship Marketplace parcels.
          </li>
          <li>
            <strong>The contractual split.</strong> When you purchase a workshop seat or Marketplace item, you
            enter into a binding agreement directly with the Vendor. offhrs is not a party to that contract.
          </li>
          <li>
            <strong>Account guidelines.</strong> offhrs may suspend or deactivate consumer or vendor accounts
            if there is a violation of these Terms, evidence of payment fraud, or abusive behaviour toward
            our community.
          </li>
        </ul>
      </section>

      <section>
        <h2>1. Definitions</h2>
        <ul>
          <li>
            <strong>&ldquo;Booking&rdquo;</strong> &mdash; a confirmed reservation for a single or recurring
            workshop session hosted by a Vendor and processed through the offhrs engine.
          </li>
          <li>
            <strong>&ldquo;Refund / cancellation policy&rdquo;</strong> &mdash; the refund window (e.g. 24 or
            48 hours before the workshop start time) configured by a Vendor on their dashboard. Consumers may
            self-serve cancellations and refunds inside the app when the workshop is outside that window. The
            Platform minimum is 24 hours.
          </li>
          <li>
            <strong>&ldquo;Consumer&rdquo;</strong> &mdash; you, the end user searching or booking workshops
            through the mobile or web app.
          </li>
          <li>
            <strong>&ldquo;Scheduling engine&rdquo;</strong> &mdash; offhrs&rsquo; proprietary date-parsing,
            slot-rendering, and conflict-blocking system used to manage local event availability and reconcile
            slot counts on booking, cancellation, refund, and account deletion.
          </li>
          <li>
            <strong>&ldquo;No-show policy&rdquo;</strong> &mdash; the operational directive under which a
            Vendor may charge up to 100% of the booking total if a student fails to attend at the scheduled
            time and location.
          </li>
          <li>
            <strong>&ldquo;SaaS subscription&rdquo;</strong> &mdash; the recurring monthly fee paid by Vendors
            to maintain their dashboard on partners.offhrs.app. Plans start at $29 CAD/month (Lite) or $49
            CAD/month (Pro), plus 13% Ontario HST.
          </li>
          <li>
            <strong>&ldquo;Marketplace Order&rdquo;</strong> &mdash; a purchase of physical goods from a Vendor
            through the Artist Marketplace (Shop) in the offhrs apps, including shipped and local-pickup
            fulfillment.
          </li>
          <li>
            <strong>&ldquo;Vendor / Partner&rdquo;</strong> &mdash; the creative studio, independent artisan,
            or business hosting the workshop or class, or selling Marketplace goods.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Our relationship &amp; scope</h2>
        <p>
          offhrs provides software that streamlines marketplace mechanics. We do not own, lease, operate, or
          staff any physical workshop studios, nor do we handle materials (clay, flora, culinary
          ingredients, and so on).
        </p>
        <p>
          When you complete a checkout, offhrs acts as a <strong>limited commercial agent</strong> on behalf
          of the Vendor: your payment satisfies your debt to that Vendor. Legal fulfilment of the class
          rests entirely with the business hosting the event.
        </p>
      </section>

      <section>
        <h2>3. Financial transactions, deposits, and processing fees</h2>
        <p>All monetary conversions on the Platform are processed via Stripe.</p>

        <h3 className="mt-4">3.1 Currency &amp; local taxation</h3>
        <ul>
          <li>All transactions are processed in Canadian dollars ($CAD).</li>
          <li>
            <strong>SaaS billing.</strong> offhrs adds 13% HST to the monthly vendor fee, filing under our CRA
            Business Number <strong>717928832 RT 0001</strong>.
          </li>
          <li>
            <strong>Workshop billing.</strong> Vendors configure workshop GST/HST status in their dashboard.
            Where the Vendor is registered and workshop tax is collected into their Stripe Connect account,
            remittance of that workshop tax remains the Vendor&rsquo;s responsibility unless we notify you
            otherwise in writing.
          </li>
          <li>
            <strong>Marketplace billing.</strong> For Artist Marketplace goods, where CRA marketplace
            facilitator rules apply, offhrs may calculate, collect, and remit applicable GST/HST via Stripe Tax
            on the platform account. Buyer-paid shipping is held to fund prepaid Canada Post labels and is not
            Vendor merchandise earnings. See the Marketplace Seller Addendum and Terms of Use.
          </li>
        </ul>

        <h3 className="mt-4">3.2 Processing rules</h3>
        <p>
          Stripe standard processing fees (currently 2.9% + $0.30 CAD on Canadian-issued cards, with higher
          rates for international or premium cards) apply to the gross transaction sum cleared from the
          consumer&rsquo;s card. This base includes any tax, delivery fees, and material margins added by the
          Vendor.
        </p>
        <p>
          <strong>
            These processing fees are borne by the Vendor and are deducted from the Vendor&rsquo;s net
            payout.
          </strong>{' '}
          offhrs does not mark up, retain, or otherwise share in Stripe&rsquo;s processing fees. For Marketplace
          sales, offhrs also charges a separate 5% platform fee on the item subtotal (excluding tax and
          shipping postage).
        </p>

        <h3 className="mt-4">3.3 Refunds</h3>
        <p>
          When a consumer self-serves a workshop refund or a Vendor issues a workshop refund from the dashboard,
          offhrs creates a Stripe refund against the original PaymentIntent, updates the booking status to{' '}
          <em>refunded</em>, and reconciles the affected event&rsquo;s available slots so capacity is
          restored. The full amount paid by the consumer (including applicable tax) is returned to the
          consumer&rsquo;s original payment method.
        </p>
        <p>
          For Marketplace Orders, refunds before carrier First Scan (or before completed pickup) may be issued
          when permitted by the Platform and carrier label-void rules. After First Scan, Platform cancellation
          of the paid order is generally blocked; see Section 3.5 for quality claims.
        </p>
        <p>
          <strong>
            Stripe processing fees on refunded transactions are non-refundable by Stripe and remain the
            responsibility of the Vendor.
          </strong>{' '}
          When a refund is issued, the original payout to the Vendor&rsquo;s Stripe Connect Express account
          is reversed in full, and the Stripe processing fee charged at the time of the original transaction
          is netted against the Vendor&rsquo;s balance. As a result, a refunded booking will typically show a
          small negative impact on the Vendor&rsquo;s balance equal to the original Stripe processing fee.
          Vendors are encouraged to factor this risk into their configured refund window.
        </p>

        <h3 className="mt-4">3.4 Chargebacks and payment disputes</h3>
        <p>
          If you have a concern about a charge, you agree to contact offhrs at{' '}
          <a href="mailto:hello@offhrs.app">hello@offhrs.app</a> (and, where appropriate, the Vendor) before
          initiating a chargeback, payment reversal, or similar dispute with your bank or card issuer. We will
          work in good faith to investigate and resolve legitimate issues under these Terms and the
          Vendor&rsquo;s stated policies.
        </p>
        <p>
          If you initiate a chargeback or payment dispute for a transaction that was validly processed under
          these Terms &mdash; including where a workshop was delivered or made available as booked, a
          cancellation or refund policy was correctly applied, Marketplace goods were fulfilled or shipped
          with tracking as described, or a Partner subscription fee was properly charged &mdash; you may be
          liable for the disputed amount, associated Stripe dispute fees, and reasonable administrative costs.
          offhrs may recover such amounts by reversing related credits, offsetting amounts owed, charging a
          payment method on file where authorized, and/or limiting or suspending your account.
        </p>
        <ul>
          <li>
            <strong>Host and seller policies.</strong> Each Vendor sets workshop cancellation terms and may
            set Marketplace buyer&rsquo;s-remorse return policies (disclosed at purchase). Damaged or
            significantly not-as-described goods are subject to platform minimum rules described in the
            Marketplace Seller Addendum.
          </li>
          <li>
            <strong>How disputes are handled.</strong> Payments are routed to the Vendor&rsquo;s Stripe
            Connect account (with Marketplace shipping and facilitator tax held on the platform as described
            above). Dispute fees and reversed amounts are handled under Stripe Connect rules and may
            affect the Vendor&rsquo;s payout balance; Vendors authorize offhrs to claw back amounts as set out
            in the Terms of Use.
          </li>
        </ul>

        <h3 className="mt-4">3.5 Marketplace Orders, tracking, and quality claims</h3>
        <ul>
          <li>
            You can view Marketplace purchases under <strong>Profile → Orders</strong> in the mobile app.
            Tracking appears after the carrier First Scan when available.
          </li>
          <li>
            For damaged goods or items significantly not as described, report the issue within{' '}
            <strong>14 days</strong> of delivery or pickup using in-app reporting where available, or email{' '}
            <a href="mailto:hello@offhrs.app">hello@offhrs.app</a> with photos. Buyer&rsquo;s-remorse returns
            may be declined if the listing disclosed a no-remorse-returns policy.
          </li>
          <li>
            offhrs does not warehouse goods and does not operate a platform shipping-protection guarantee.
            Lost-in-transit coverage follows the carrier insurance purchased for the label.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Scheduling engine integrity</h2>
        <ul>
          <li>
            <strong>Accuracy.</strong> Vendors must keep their dashboard schedule accurate to prevent
            double-booking.
          </li>
          <li>
            <strong>Conflicts.</strong> If a Vendor fails to log time flags properly or enters invalid dates,
            offhrs is not liable for parsing errors or downstream consumer schedule conflicts.
          </li>
          <li>
            <strong>Fairness.</strong> Systematically altering availability to provoke consumer cancellation
            fees constitutes platform manipulation. We audit schedule changes and may shut down accounts
            showing patterns of manipulation.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Health, safety, and material requirements</h2>
        <p>It is the sole responsibility of the consumer to review workshop parameters prior to booking.</p>
        <ul>
          <li>
            <strong>Disclosures.</strong> Notify the Vendor directly in advance of any allergies, physical
            limitations, or medical situations (respiratory sensitivities near kilns, mobility needs,
            ingredient restrictions) that could affect your safety during a workshop.
          </li>
          <li>
            <strong>Liability limitations.</strong> Neither offhrs nor the hosting Vendor shall be held
            responsible for medical developments, property damage, or injuries resulting from a
            consumer&rsquo;s failure to disclose a health condition or check workshop suitability before the
            class begins.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Access restrictions and account suspension</h2>
        <p>offhrs reserves the right to limit, suspend, or revoke access without notice if:</p>
        <ul>
          <li>A user shows an abnormal pattern of chargebacks, payment failures, or last-minute cancellations;</li>
          <li>Our fraud systems flag the account interactions or billing signatures as high-risk;</li>
          <li>You engage in abusive, inappropriate, or discriminatory behaviour toward our team or any Vendor staff member; or</li>
          <li>
            You attempt to scrape application assets, extract scheduling-engine architecture, or bypass the
            platform payment flow to complete a booking off-platform.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Limitation of liability &amp; indemnification</h2>
        <ul>
          <li>
            <strong>Uptime boundaries.</strong> We cannot guarantee continuous, error-free operation of our
            scheduling engine or network routing. Access may be temporarily limited for code updates or
            database maintenance.
          </li>
          <li>
            <strong>Event disruption.</strong> offhrs is not legally responsible for class cancellations
            caused by studio failures, instructor availability, or weather events in the Greater Toronto
            Area.
          </li>
          <li>
            <strong>Liability cap.</strong> To the absolute limit permitted under Ontario law, offhrs&rsquo;
            total financial liability to any user for any system error is strictly capped at the total amount
            paid by that user directly to offhrs over the immediate ninety (90) days preceding the claim.
          </li>
          <li>
            <strong>Indemnity.</strong> You agree to protect, defend, and hold harmless offhrs from any
            third-party claims, losses, damages, or liabilities (including legal fees) resulting from your
            misuse of the platform, violation of these Terms, or physical actions during a marketplace
            workshop.
          </li>
        </ul>
      </section>

      <section>
        <h2>8. Governing law &amp; local jurisdiction</h2>
        <p>
          These Service Terms are governed by the laws of the Province of Ontario and the federal laws of
          Canada applicable therein. Any formal disagreements or legal proceedings must be handled within the
          courts located in Toronto, Ontario.
        </p>
      </section>

      <section>
        <h2>9. Resolution support</h2>
        <p>
          If you are unhappy with a workshop experience, we want to know so we can keep the marketplace
          standard high. First, communicate directly with the studio owner to find an alignment or organize
          an alternative date. If you cannot reach a fair agreement, email our team at{' '}
          <a href="mailto:hello@offhrs.app">hello@offhrs.app</a>. While we are not legally obligated to issue
          refunds for a Vendor&rsquo;s class, we review escalations on a case-by-case basis to help maintain
          a great experience for everyone.
        </p>
      </section>
    </LegalPageLayout>
  )
}
