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
            a vendor portal (partners.offhrs.app) that lets you find, schedule, and register for in-person
            creative workshops (pottery, floral arts, culinary events, and similar) in Toronto and
            surrounding areas.
          </li>
          <li>
            <strong>Our intermediary role.</strong> The workshops, materials, and physical instruction spaces
            you register for are owned, fulfilled, and operated by our independent third-party partners
            (&ldquo;Vendors&rdquo;) &mdash; not by us. offhrs acts as a technology intermediary and limited
            commercial payment collection agent for those Vendors.
          </li>
          <li>
            <strong>The contractual split.</strong> When you purchase a workshop seat, you enter into a
            binding agreement directly with the Vendor (subject to their studio rules, material waivers, and
            safety codes). offhrs is not a party to that contract.
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
            <strong>&ldquo;Vendor / Partner&rdquo;</strong> &mdash; the creative studio, independent artisan,
            or business hosting the workshop or class.
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
            <strong>Marketplace billing.</strong> Vendors are responsible for setting up their tax status in
            their profile. If a Vendor is HST-registered, our tax calculation applies the correct provincial
            rate at checkout, routing the tax portion directly into the Vendor&rsquo;s Stripe Connect Express
            balance.
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
          offhrs does not mark up, retain, or otherwise share in Stripe&rsquo;s processing fees.
        </p>

        <h3 className="mt-4">3.3 Refunds</h3>
        <p>
          When a consumer self-serves a refund or a Vendor issues a refund from the dashboard, offhrs creates
          a Stripe refund against the original PaymentIntent, updates the booking status to{' '}
          <em>refunded</em>, and reconciles the affected event&rsquo;s available slots so capacity is
          restored. The full amount paid by the consumer (including HST) is returned to the
          consumer&rsquo;s original payment method.
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
          <a href="mailto:admin@offhrs.app">admin@offhrs.app</a>. While we are not legally obligated to issue
          refunds for a Vendor&rsquo;s class, we review escalations on a case-by-case basis to help maintain
          a great experience for everyone.
        </p>
      </section>
    </LegalPageLayout>
  )
}
