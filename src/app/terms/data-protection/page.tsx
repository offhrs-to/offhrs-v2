import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/legal-page-layout'

export const metadata: Metadata = {
  title: 'Data Protection Addendum | offhrs',
  description:
    'Data Protection Addendum governing the processing of customer data by offhrs on behalf of partner vendors.',
  alternates: { canonical: 'https://offhrs.app/terms/data-protection' },
}

export default function DataProtectionPage() {
  return (
    <LegalPageLayout slug="data-protection">
      <section>
        <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-md p-3">
          This Data Protection Addendum (&ldquo;DPA&rdquo;) is incorporated into and forms an essential part
          of the offhrs Partner Terms of Business (the &ldquo;Agreement&rdquo;) entered into between the
          Vendor/Studio (&ldquo;Partner&rdquo;) and offhrs (&ldquo;Platform&rdquo;). In the event of a
          conflict between this DPA and the general terms of the Agreement, this DPA shall take precedence
          regarding data-handling procedures.
        </p>
      </section>

      <section>
        <h2>1. Definitions &amp; interpretive framework</h2>
        <ul>
          <li>
            <strong>Applicable privacy laws</strong> &mdash; the Personal Information Protection and
            Electronic Documents Act (PIPEDA, SC 2000, c 5) and any applicable provincial privacy statutes
            within Canada, including Ontario guidelines.
          </li>
          <li>
            <strong>Data custodian (organization)</strong> &mdash; the Partner, who retains legal authority
            and accountability for the collection of student records.
          </li>
          <li>
            <strong>Data service provider (processor)</strong> &mdash; offhrs, which provides technical
            database hosting, scheduling operations, and transaction infrastructure.
          </li>
          <li>
            <strong>Personal data</strong> &mdash; any uniquely identifiable information relating to a
            student, customer, or staff member uploaded to partners.offhrs.app by the Partner, or submitted
            directly by a consumer to book a slot.
          </li>
          <li>
            <strong>Security incident</strong> &mdash; any unauthorized database access, exposure, or leakage
            that compromises the confidentiality, integrity, or availability of personal data hosted on
            offhrs infrastructure.
          </li>
          <li>
            <strong>Staff profiles</strong> &mdash; personnel data uploaded by the Partner, including names,
            instructor bios, availability, and dashboard access states.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Allocation of regulatory roles</h2>
        <ul>
          <li>
            <strong>The Partner&rsquo;s role.</strong> The Partner is the primary organization collecting
            customer data and is responsible for obtaining the necessary consent from students before that
            data is processed through the Platform.
          </li>
          <li>
            <strong>The Platform&rsquo;s role.</strong> offhrs acts strictly as a data service provider. We
            process personal information only to maintain the scheduling, booking, and payment functions at
            the Partner&rsquo;s direction.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Structural parameters of processing</h2>

        <h3 className="mt-4">3.1 Scope &amp; purpose</h3>
        <p>
          The Platform processes data for operating a localized workshop and Artist Marketplace:
          scheduling, customer checkouts, registration tallies, Marketplace order fulfillment (including
          sharing shipping addresses with Vendors), refunds, slot reconciliation, and conflict checks.
        </p>

        <h3 className="mt-4">3.2 Data categories &amp; restrictions</h3>
        <ul>
          <li>
            <strong>Permitted customer data:</strong> first and last names, email addresses, mobile numbers
            (for automated system messages), booking and Marketplace order history, shipping addresses for
            paid Marketplace orders, refund history, and transaction status codes.
          </li>
          <li>
            <strong>Marketplace shipping data.</strong> Partners may use buyer name and address only to fulfill
            the order (label or pickup) or respond to a quality claim. Marketing use requires explicit opt-in
            (see Privacy Policy and Marketplace Seller Addendum).
          </li>
          <li>
            <strong>Permitted staff data:</strong> names, role titles, class specializations, and
            availability profiles.
          </li>
          <li>
            <strong>Prohibited special-category data:</strong> Partners are strictly prohibited from using
            intake forms or custom fields to collect or store sensitive personal information (government IDs,
            health-status indicators, sensitive financial data) within the standard offhrs databases. If a
            Partner collects this information for studio safety, they must maintain it off-platform under
            their own data controller responsibilities.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Technical security &amp; isolation measures</h2>
        <ul>
          <li>
            <strong>Storage security.</strong> All operational data is stored on managed database clusters
            with <strong>Row Level Security (RLS)</strong> enabled. This ensures one vendor&rsquo;s dashboard
            cannot view, edit, or pull the records of a competing studio.
          </li>
          <li>
            <strong>Authentication security.</strong> Dashboard access is protected by tokenized session
            protocols (JWT) and supports Google and Apple SSO. Partners must keep these credentials
            confidential.
          </li>
          <li>
            <strong>Confidentiality.</strong> Any technical staff or automated maintenance sub-routines
            operating under offhrs are bound by strict system confidentiality requirements.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Security incident management &amp; notifications</h2>
        <ul>
          <li>
            <strong>Breach reporting.</strong> In the event of a confirmed Security Incident impacting your
            student or studio data, offhrs will notify the impacted Partner without undue delay, and where
            feasible within <strong>72 hours</strong> of technical discovery.
          </li>
          <li>
            <strong>Mitigation responsibilities.</strong> offhrs will take immediate steps to patch
            vulnerabilities and secure the system. The Partner remains responsible for providing any
            required legal disclosures to their individual students or provincial privacy commissioners if
            mandated by PIPEDA thresholds.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Managing consumer data requests</h2>
        <ul>
          <li>
            <strong>Direct tools.</strong> partners.offhrs.app includes self-service tools that allow
            Partners to update, export, or remove customer data when a student makes a request.
          </li>
          <li>
            <strong>Platform intervention.</strong> If a student contacts offhrs directly regarding data
            deletion or account removal, our system removes the consumer&rsquo;s personal data from the
            customer-facing records and reconciles the affected workshop slots so the Partner sees accurate
            availability without retaining stale personal data.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Retaining and exporting studio data</h2>
        <ul>
          <li>
            <strong>Post-termination window.</strong> Upon the cancellation or termination of your SaaS
            subscription (Lite or Pro), the Partner has <strong>thirty (30) days</strong> to export historic
            booking ledgers, customer contact lists, and instructor data via the dashboard export utilities.
          </li>
          <li>
            <strong>Permanent deletion.</strong> Following this 30-day window, offhrs reserves the right to
            permanently purge the associated database records from active production instances.
          </li>
          <li>
            <strong>Regulatory exemption.</strong> offhrs will retain specific transactional tax data, HST
            billing logs, and Stripe settlement records beyond this period for up to <strong>six (6)
            years</strong>, solely to comply with Canada Revenue Agency audit requirements.
          </li>
        </ul>
      </section>

      <section>
        <h2>8. Limitation of liability</h2>
        <p>
          offhrs&rsquo; total liability for any data mishandling, server exposure, or regulatory fine issued
          under this DPA is subject to the overall financial limitations in the offhrs Service Terms and
          shall not exceed the subscription amounts paid by the Partner to the Platform over the preceding
          three (3) months.
        </p>
      </section>
    </LegalPageLayout>
  )
}
