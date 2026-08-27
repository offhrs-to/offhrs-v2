import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/legal-page-layout'

export const metadata: Metadata = {
  title: 'Marketplace Seller Addendum | offhrs',
  description:
    'Additional terms for Vendors selling physical goods on the offhrs Artist Marketplace.',
  alternates: { canonical: 'https://offhrs.app/terms/marketplace-seller-addendum' },
}

export default function MarketplaceSellerAddendumPage() {
  return (
    <LegalPageLayout slug="marketplace-seller-addendum">
      <section>
        <h2>1. Scope</h2>
        <p>
          This Addendum applies when you enable the Artist Marketplace on partners.offhrs.app (included with
          Lite/Pro, or via free Marketplace-only enrollment). It supplements the Terms of Use, Privacy Policy,
          Content Policy, and Data Protection Addendum. Capitalized terms have the meanings in those documents
          unless defined here.
        </p>
        <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-md p-3">
          <strong>Counsel note:</strong> Marketplace checkout and shipping features may roll out in stages.
          These terms govern Marketplace activity as soon as you list or sell goods on the Platform.
        </p>
      </section>

      <section>
        <h2>2. Seller of record, fees, and Canada-only</h2>
        <ul>
          <li>You are the seller of record for Marketplace goods. offhrs does not take title to inventory.</li>
          <li>
            Platform fee: <strong>5%</strong> of item subtotal (ex-tax), plus Stripe processing (~2.9% + $0.30
            CAD), separate from workshop bookings (0% commission).
          </li>
          <li>Sales and shipping are <strong>Canada only</strong> (CAD). You must ship from a Canadian address.</li>
          <li>
            Buyer-paid shipping funds prepaid Canada Post labels purchased on offhrs&rsquo; Shippo account. You
            print the label and drop the parcel at Canada Post. Postage is not merchandise revenue.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Risk of loss, insurance, and claims</h2>
        <ul>
          <li>
            <strong>First Scan.</strong> Obtain a drop-off receipt (or equivalent). Carrier acceptance /
            first scan starts lost-in-transit claim eligibility.
          </li>
          <li>
            <strong>Lost in transit.</strong> Claims are filed with Canada Post. Reimbursement to the buyer is
            limited to the carrier&rsquo;s insurance payout (including any extra insurance purchased at
            checkout). Any gap above that payout is your responsibility. offhrs does not operate a Platform
            Protection Guarantee.
          </li>
          <li>
            <strong>Delivered.</strong> After a Delivered scan, porch theft / post-delivery loss is the
            buyer&rsquo;s risk (subject to chargeback rules in the Terms of Use).
          </li>
          <li>
            Items priced above <strong>$250 CAD</strong> may automatically include signature confirmation and
            full coverage insurance, with the extra cost passed to the buyer at checkout.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Ship-by SLA and cancellations</h2>
        <ul>
          <li>
            Default: purchase label and drop off within <strong>5 business days</strong> of payment unless you
            set a longer made-to-order window disclosed at checkout.
          </li>
          <li>
            Buyer cancel <strong>before</strong> First Scan: full refund; label voided when possible. After
            First Scan: cancellation blocked; returns follow Section 5 with buyer paying return shipping unless
            damaged/SNAD rules apply.
          </li>
          <li>
            You warrant accurate weight and dimensions. Postage adjustments (APV) may be charged back to you via
            Stripe Connect.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Returns</h2>
        <ul>
          <li>
            You may select <strong>no returns for buyer&rsquo;s remorse</strong> if clearly disclosed before
            purchase.
          </li>
          <li>
            You <strong>must</strong> accept refunds/returns for goods that are damaged in transit or
            significantly not as described within <strong>14 days</strong> of delivery. Damaged-in-transit
            claims require photos of the box and item.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Chargebacks</h2>
        <p>
          Chargebacks on Marketplace orders are governed by the Terms of Use. You authorize Connect
          debit/offset for disputed amounts, Stripe dispute fees, and related costs, and must provide evidence
          (labels, tracking, packing or pickup proof).
        </p>
      </section>

      <section>
        <h2>7. Buyer personal information (PIPEDA)</h2>
        <p>
          Shipping name and address are shared only so you can fulfill the order (print a label or coordinate
          pickup). You must not add the buyer&rsquo;s email or address to your own marketing lists without
          explicit opt-in, and you must not use that data for any other purpose.
        </p>
      </section>

      <section>
        <h2>8. Prohibited goods</h2>
        <p>
          You must follow the Content Policy. No weapons, controlled substances, hazardous materials,
          recalled goods, counterfeit or dropshipped junk, or other unlawful items. Disclose whether art is an
          original or a reproduction/print.
        </p>
      </section>
    </LegalPageLayout>
  )
}
