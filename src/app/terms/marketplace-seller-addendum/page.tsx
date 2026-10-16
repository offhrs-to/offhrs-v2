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
          Pro / Full License, or via free Marketplace-only enrollment). It supplements the Terms of Use, Service
          Terms, Privacy Policy, Content Policy, and Data Protection Addendum. Capitalized terms have the
          meanings in those documents unless defined here. You accept this Addendum when you enable the
          Artist Marketplace, publish a Marketplace product, or confirm the shipping attestation in your
          dashboard.
        </p>
        <p>
          You manage products, shipping settings, and orders under <strong>Marketplace</strong> in the Partners
          dashboard. Buyers shop in the offhrs mobile app (<strong>Shop</strong> tab) and view purchases under{' '}
          <strong>Profile → Orders</strong>.
        </p>
        <p>
          Shopify Sync applies to workshop listings only. It does not list physical goods from your Shopify
          store on the Artist Marketplace.
        </p>
      </section>

      <section>
        <h2>2. Seller of record, fees, postage, and tax</h2>
        <ul>
          <li>You are the seller of record for Marketplace goods. offhrs does not take title to inventory.</li>
          <li>
            Platform fee: <strong>5%</strong> of item subtotal (ex-tax), plus Stripe processing (~2.9% + $0.30
            CAD), separate from workshop bookings (0% commission).
          </li>
          <li>Sales and shipping are <strong>Canada only</strong> (CAD). You must ship from a Canadian address.</li>
          <li>
            Buyer-paid shipping (Canada Post rate quote plus any handling fee you set) is collected at checkout
            and <strong>held by offhrs</strong> to purchase prepaid labels on offhrs&rsquo; Shippo account. You
            print the label and drop the parcel at Canada Post. Postage and handling collected for shipping are{' '}
            <strong>not</strong> merchandise revenue and are <strong>not</strong> paid out as seller earnings.
          </li>
          <li>
            If you are registered for GST/HST, offhrs calculates and collects applicable GST/HST on
            Marketplace sales at checkout into your Stripe Connect account (same model as workshop
            tickets). That tax is paid out to you with the order and you remain responsible for remitting
            it to the CRA. If you are not registered, offhrs does not collect GST/HST on Marketplace
            checkout. You must keep your registration status and number accurate in dashboard tax
            settings (see the Terms of Use, Section 2).
          </li>
          <li>
            Your approximate Marketplace payout is the item subtotal minus the 5% platform fee and Stripe
            processing fees, subject to refunds, adjustments, and clawbacks described below.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Fulfillment, First Scan, insurance, and pickup</h2>
        <ul>
          <li>
            For shipped orders, purchase a prepaid label from the Orders panel and obtain a drop-off receipt (or
            equivalent). Carrier acceptance / <strong>First Scan</strong> is the milestone after which
            lost-in-transit claim eligibility with Canada Post generally begins and buyer cancellation /
            platform refund of the order is blocked.
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
            Orders with an item subtotal of <strong>$250 CAD or more</strong> may automatically include
            signature confirmation and carrier insurance, with the extra cost passed to the buyer at checkout.
          </li>
          <li>
            If you offer local pickup, coordinate pickup as disclosed; mark the order picked up in the
            dashboard when the buyer collects the goods.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Ship-by SLA and cancellations</h2>
        <ul>
          <li>
            Default: purchase label and drop off within <strong>5 business days</strong> of payment unless you
            set a longer made-to-order window disclosed at checkout. offhrs may send ship-by reminders.
          </li>
          <li>
            If an order is not labelled and shipped (or, for pickup, made available) within the ship-by
            window, offhrs may, but is not required to, cancel and refund the order before First Scan.
            Repeated missed ship-by windows may result in delisting of your products or suspension of
            Marketplace access.
          </li>
          <li>
            Buyer or seller cancel <strong>before</strong> First Scan: full refund when permitted; labels are
            voided when the carrier allows (Canada Post may impose a short non-void window after purchase).
            The buyer receives the full amount paid. Stripe does not return its processing fee, and that fee
            remains your responsibility, the same as a refunded workshop booking.
            After First Scan: cancellation and platform refund of the paid order are blocked; quality issues
            follow Section 5.
          </li>
          <li>
            You warrant accurate weight and dimensions. Carrier postage adjustments (APV / underpaid postage)
            may be charged back to you via Stripe Connect debit, transfer reversal, or invoice.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Returns and SNAD / damaged claims</h2>
        <ul>
          <li>
            You may select <strong>no returns for buyer&rsquo;s remorse</strong> if clearly disclosed before
            purchase.
          </li>
          <li>
            You <strong>must</strong> address goods that are damaged in transit or significantly not as
            described (<strong>SNAD</strong>) within <strong>14 days</strong> of delivery or pickup. Buyers may
            open a claim in the app (or via <a href="mailto:hello@offhrs.app">hello@offhrs.app</a>). Photos of
            the packaging and item should be provided when relevant. You should respond promptly in the Orders
            panel; offhrs may resolve or reject claims in good faith.
          </li>
          <li>
            This is not a full returns portal. Refusing valid damaged/SNAD remedies may lead to chargebacks and
            Connect clawbacks under the Terms of Use.
          </li>
          <li>
            Where a refund or other remedy to the buyer arising from a claim is funded by offhrs or Stripe on
            your behalf, you authorize offhrs to recover it by the same means described in Section 6.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Chargebacks and clawbacks</h2>
        <p>
          Chargebacks on Marketplace orders are governed by the Terms of Use. You authorize Connect debit,
          transfer reversal, offset, or invoice for disputed amounts, Stripe dispute fees (currently about CAD
          $15 per dispute, subject to change), APV shortfalls, and related costs. You must provide evidence
          (labels, tracking, packing or pickup proof). Repeated clawback failures or abnormal dispute rates may
          result in suspension of Marketplace access.
        </p>
      </section>

      <section>
        <h2>7. Buyer personal information (PIPEDA)</h2>
        <p>
          Shipping name and address (and email/phone as needed) are shared only so you can fulfill the order
          (print a label or coordinate pickup) or respond to a claim. You must not add the buyer&rsquo;s email
          or address to your own marketing lists without explicit opt-in, and you must not use that data for any
          other purpose.
        </p>
        <p>
          You are accountable under PIPEDA for the buyer information you receive. You must keep it secure,
          keep it only as long as needed to fulfill the order, handle any claim, and meet your legal
          record-keeping duties, then delete or de-identify it, and notify us promptly at{' '}
          <a href="mailto:hello@offhrs.app">hello@offhrs.app</a> if you suspect unauthorized access to it.
        </p>
      </section>

      <section>
        <h2>8. Prohibited goods</h2>
        <p>
          You must follow the Content Policy. No weapons, controlled substances, hazardous materials,
          recalled goods, counterfeit goods, mass-produced or dropshipped goods misrepresented as handmade or
          locally made, or other unlawful items. Disclose whether art is an original or a reproduction/print.
          First Marketplace-only sellers may be subject to manual listing review before going live.
        </p>
      </section>

      <section>
        <h2>9. Product responsibility and indemnity</h2>
        <p>
          You are solely responsible for your products, including their safety, labelling, legality, and any
          recall, and for packaging them properly for shipment. You must consider carrying product liability
          insurance appropriate to what you sell. The Vendor indemnity in Section 7 of the Terms of Use applies
          to Marketplace goods and orders.
        </p>
      </section>
    </LegalPageLayout>
  )
}
