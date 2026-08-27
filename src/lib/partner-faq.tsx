import type { ReactNode } from 'react'
import {
  formatPartnerMonthlyAmount,
  PARTNER_PLAN_MONTHLY_CAD,
  PARTNER_TRIAL_LABEL,
  SHOPIFY_SYNC_MONTHLY_CAD,
  SHOPIFY_SYNC_PLAN_NAME,
} from '@/lib/partner-pricing'

export type PartnerFaqItem = {
  q: string
  /** Plain-text answer for FAQPage JSON-LD and text fallbacks. */
  aText: string
  /** Rich answer for the accordion UI. Defaults to a single paragraph of `aText` when omitted. */
  a?: ReactNode
}

export type PartnerFaqSection = {
  id: string
  title: string
  items: PartnerFaqItem[]
}

/**
 * Single source of truth for partner FAQs on `/partners` and `/partners/dashboard/faq`.
 */
export const PARTNER_FAQ_SECTIONS: PartnerFaqSection[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    items: [
      {
        q: 'How does hosting work?',
        aText:
          'We connect local creative experts with guests looking for hands-on experiences—from pottery and floral design to coffee and beyond. You list your workshops, set your availability, and we handle discovery, booking, and payments.',
      },
      {
        q: 'What types of experiences can I list?',
        aText:
          'We focus on social, creative, and hands-on experiences—pottery, floral, painting, coffee, culinary, and more. If you teach a creative skill and want to grow your community in Toronto, we can help you get started.',
      },
      {
        q: 'I already list on other platforms. Can I host on offhrs as well?',
        aText:
          'Yes. You are welcome to list on multiple platforms—we do not require exclusivity, and there are no programs that reward hosts who list only with us. When capacity is shared across channels, use the “Booked elsewhere” option when creating or editing a workshop to reserve seats already filled outside offhrs.',
      },
      {
        q: 'How do I become a partner?',
        aText:
          'Sign up through the partner signup wizard. You’ll provide your business name, 1–4 workshop categories, your location, an account email and password, and optionally a website, phone number, and a workshop logo (JPEG/PNG/WebP, up to 2 MB). After you create your account you’ll verify your email, then set up billing.',
      },
      {
        q: 'Do I have to verify my email?',
        aText:
          'Yes. New accounts must confirm their email via the link we send before you can start a plan and access billing. Once verified you’re taken straight to the billing step.',
      },
      {
        q: 'What happens after I sign up and pay?',
        aText:
          'Your dashboard walks you through a short checklist: verify email, start your free trial, connect your Stripe payout account, confirm GST/HST status in Settings, review settings and add a bio, connect a calendar (Google or Outlook), and create your first workshop.',
        a: (
          <>
            <p>Your dashboard walks you through a short checklist:</p>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>Verify email</li>
              <li>Start your free trial</li>
              <li>Connect your Stripe payout account</li>
              <li>Confirm GST/HST status in Settings (registered or small supplier)</li>
              <li>Review settings and add a bio</li>
              <li>Connect a calendar (Google or Outlook)</li>
              <li>Create your first workshop</li>
            </ol>
          </>
        ),
      },
    ],
  },
  {
    id: 'plans-billing',
    title: 'Plans & billing',
    items: [
      {
        q: 'What does it cost to list on offhrs?',
        aText: `Lite is ${formatPartnerMonthlyAmount('lite')} CAD/month (up to 4 active workshops). Pro is ${formatPartnerMonthlyAmount('pro')} CAD/month (unlimited). ${SHOPIFY_SYNC_PLAN_NAME} is $${SHOPIFY_SYNC_MONTHLY_CAD} CAD/month (Shopify workshops mirrored into offhrs; guests book on Shopify).`,
        a: (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[#555]">
                  <th className="py-2 pr-4 font-semibold">Plan</th>
                  <th className="py-2 pr-4 font-semibold">Price</th>
                  <th className="py-2 font-semibold">What you get</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[#E8E4DE]">
                  <td className="py-2 pr-4 font-medium text-[#1a1a1a]">Lite</td>
                  <td className="py-2 pr-4">${PARTNER_PLAN_MONTHLY_CAD.lite} / month (CAD)</td>
                  <td className="py-2">Up to 4 active workshops; book &amp; pay on offhrs</td>
                </tr>
                <tr className="border-t border-[#E8E4DE]">
                  <td className="py-2 pr-4 font-medium text-[#1a1a1a]">Pro</td>
                  <td className="py-2 pr-4">${PARTNER_PLAN_MONTHLY_CAD.pro} / month (CAD)</td>
                  <td className="py-2">Unlimited workshops; book &amp; pay on offhrs</td>
                </tr>
                <tr className="border-t border-[#E8E4DE]">
                  <td className="py-2 pr-4 font-medium text-[#1a1a1a]">{SHOPIFY_SYNC_PLAN_NAME}</td>
                  <td className="py-2 pr-4">${SHOPIFY_SYNC_MONTHLY_CAD} / month (CAD)</td>
                  <td className="py-2">Shopify products in the app; guests book on Shopify</td>
                </tr>
              </tbody>
            </table>
          </div>
        ),
      },
      {
        q: 'Is there a free trial?',
        aText: `Yes — a ${PARTNER_TRIAL_LABEL} on Lite, Pro, and ${SHOPIFY_SYNC_PLAN_NAME}. You won’t be charged until the trial ends.`,
        a: (
          <p>
            Yes — a <strong>{PARTNER_TRIAL_LABEL}</strong> on Lite, Pro, and {SHOPIFY_SYNC_PLAN_NAME}. You
            won&apos;t be charged until the trial ends.
          </p>
        ),
      },
      {
        q: `What happens after my ${PARTNER_TRIAL_LABEL}?`,
        aText:
          'Your subscription automatically starts at the end of the trial at the Lite, Pro, or Shopify Sync rate you chose. You can cancel anytime before the trial ends with no charge.',
      },
      {
        q: 'How is billing handled?',
        aText:
          'Lite and Pro bill through Stripe subscription checkout. Shopify Sync bills through Shopify App Pricing on your Shopify invoice. Subscription status syncs automatically, so if a payment fails or you cancel, your account reflects it.',
      },
      {
        q: "What's the difference between Lite and Pro?",
        aText:
          'Lite caps you at 4 concurrently active (non-archived) workshops. Pro removes that cap. If you’re on Lite and hit the limit, archive an old workshop or upgrade to Pro to add more.',
      },
      {
        q: `What is ${SHOPIFY_SYNC_PLAN_NAME}?`,
        aText: `${SHOPIFY_SYNC_PLAN_NAME} is a standalone $${SHOPIFY_SYNC_MONTHLY_CAD} CAD/month plan (no Lite/Pro required). Install the offhrs app from Shopify, tag workshop products with offhrs_workshop, and sync them into the offhrs app. Guests discover you on offhrs and complete booking on your Shopify storefront. Full setup guide: /partners/shopify-sync`,
        a: (
          <p>
            {SHOPIFY_SYNC_PLAN_NAME} is a standalone ${SHOPIFY_SYNC_MONTHLY_CAD} CAD/month plan (no
            Lite/Pro required). Install the offhrs app from Shopify, tag workshop products with{' '}
            <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px]">offhrs_workshop</code>,
            and sync them into the offhrs app. Guests discover you on offhrs and complete booking on
            your Shopify storefront.{' '}
            <a href="/partners/shopify-sync" className="font-medium text-[#5D755D] underline-offset-2 hover:underline">
              Read the setup guide
            </a>
            .
          </p>
        ),
      },
      {
        q: 'What category do Shopify Sync workshops use?',
        aText:
          'Synced listings use your primary business category from partner signup (the first category you picked). You can override a product with an optional offhrs.category metafield. Re-sync after changing categories so listings update.',
        a: (
          <p>
            Synced listings use your <strong>primary business category</strong> from partner signup
            (the first category you picked). To set a different category on one product, add an
            optional{' '}
            <code className="rounded bg-[#EDF0ED] px-1.5 py-0.5 text-[13px]">offhrs.category</code>{' '}
            metafield (for example Pottery or Floral), then Sync again.
          </p>
        ),
      },
      {
        q: 'Can I cancel my subscription?',
        aText:
          'Yes, anytime from your dashboard settings (Lite/Pro) or Shopify billing (Sync). You keep access until the end of your current billing period.',
      },
    ],
  },
  {
    id: 'payouts-fees',
    title: 'Getting paid (payouts & fees)',
    items: [
      {
        q: 'How do I get paid for bookings?',
        aText:
          'Through Stripe Connect (Express). You’ll set up a Canadian payout account from your dashboard. When a customer books and pays in the app, the charge is sent on your behalf and the funds are routed to your connected Stripe account. You must finish Stripe Connect onboarding before any payouts can be released.',
        a: (
          <>
            <p>
              Through <strong>Stripe Connect (Express)</strong>. You&apos;ll set up a Canadian
              payout account from your dashboard. When a customer books and pays in the app, the
              charge is sent on your behalf and the funds are routed to your connected Stripe
              account.
            </p>
            <p className="mt-2 text-[#555]">
              You must finish Stripe Connect onboarding before any payouts can be released. You can
              view your payout history (amounts and arrival dates) in the dashboard once it&apos;s
              connected.
            </p>
          </>
        ),
      },
      {
        q: 'Does offhrs take a commission on each booking?',
        aText:
          'No — offhrs does not take a percentage commission on workshop bookings. Our revenue for workshops is the monthly Lite/Pro subscription. Stripe processing (about 2.9% + $0.30 CAD) still applies and is borne by you. Artist Marketplace goods are different: 5% platform fee on the item subtotal plus Stripe processing.',
        a: (
          <p>
            No — offhrs does <strong>not</strong> take a percentage commission on{' '}
            <strong>workshop bookings</strong>. Our revenue for workshops is the monthly subscription. What
            does apply to every paid booking is the standard{' '}
            <strong>Stripe payment processing fee (about 2.9% + $0.30 CAD per transaction)</strong>, which is
            borne by you as the vendor.
          </p>
        ),
      },
      {
        q: 'What fees apply to Artist Marketplace sales?',
        aText:
          'Marketplace sales: 5% platform fee on the item subtotal (excluding tax and shipping), plus Stripe processing (about 2.9% + $0.30 CAD). Buyer-paid shipping funds the prepaid Canada Post label. Lite/Pro includes Marketplace; there is also a free Marketplace-only signup.',
        a: (
          <>
            <p>
              For <strong>Artist Marketplace</strong> goods, offhrs charges a{' '}
              <strong>5% platform fee</strong> on the item subtotal (excluding tax and shipping postage),{' '}
              <strong>plus</strong> Stripe processing (about 2.9% + $0.30 CAD). Shipping paid by the buyer is
              used to purchase the prepaid Canada Post label and is not merchandise revenue.
            </p>
            <p className="mt-2 text-[#555]">
              Lite and Pro include Marketplace access. Artists who only want to sell goods can enroll in a
              free Marketplace-only plan (same 5% + Stripe on sales). See the{' '}
              <a className="underline" href="/terms/marketplace-seller-addendum">
                Marketplace Seller Addendum
              </a>
              .
            </p>
          </>
        ),
      },
      {
        q: 'When do payouts arrive?',
        aText:
          'Payouts are issued by Stripe on Stripe’s standard schedule for your account. You can track each payout’s status and expected arrival date in the dashboard.',
      },
    ],
  },
  {
    id: 'refunds',
    title: 'Refunds & cancellations',
    items: [
      {
        q: 'Who absorbs the processing fee when a booking is refunded?',
        aText:
          'The vendor does. In Canada, Stripe does not return the original processing fee when a charge is refunded. When you (or a customer) refund a booking, the funds are pulled back from your connected account and the original processing fee is not recovered — so the vendor absorbs that fee. This is by design and is disclosed in our terms.',
      },
      {
        q: 'How does the cancellation/refund window work?',
        aText:
          'Each workshop has a refund window — the cutoff (in hours before the session starts) for a full refund. The default is 48 hours. Customers who cancel before the cutoff get a full refund automatically; after the cutoff, they’re told that cancellations with a full refund must be made at least X hours before the session.',
        a: (
          <p>
            Each workshop has a <strong>refund window</strong> — the cutoff (in hours before the
            session starts) for a full refund. The default is <strong>48 hours</strong>. Customers
            who cancel before the cutoff get a full refund automatically; after the cutoff,
            they&apos;re told that cancellations with a full refund must be made at least X hours
            before the session.
          </p>
        ),
      },
      {
        q: 'Can I change my refund window?',
        aText:
          'Yes, in your settings. You can set anything from a minimum of 24 hours (platform policy) up to 8,760 hours (1 year).',
        a: (
          <p>
            Yes, in your settings. You can set anything from a minimum of <strong>24 hours</strong>{' '}
            (platform policy) up to <strong>8,760 hours (1 year)</strong>.
          </p>
        ),
      },
      {
        q: 'What happens to existing bookings if I archive a workshop?',
        aText:
          'Archiving is a soft delete. When you archive a workshop, any active bookings on it are automatically refunded, and the workshop is hidden from customers.',
      },
    ],
  },
  {
    id: 'taxes',
    title: 'Taxes',
    items: [
      {
        q: 'Where do I set my GST/HST status?',
        aText:
          'Open Settings in your partner dashboard and scroll to Workshop sales tax (GST/HST). Confirm whether you are registered with the CRA. If registered, turn the option on, enter your GST/HST registration number (BN), and save. If you are a small supplier (not registered), leave the option off and save so we know not to add GST/HST to ticket prices.',
        a: (
          <>
            <p>
              Open <strong>Settings</strong> in your partner dashboard and scroll to{' '}
              <strong>Workshop sales tax (GST/HST)</strong>. Confirm whether you are registered with
              the CRA:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Registered</strong> — turn the option on, enter your GST/HST registration
                number (BN), and click <strong>Save tax settings</strong>. Tax will be calculated at
                checkout on your connected Stripe account.
              </li>
              <li>
                <strong>Small supplier (not registered)</strong> — leave the option off and click{' '}
                <strong>Save tax settings</strong> so we know not to add GST/HST to ticket prices.
              </li>
            </ul>
            <p className="mt-2 text-[#555]">
              You&apos;ll also see this on your getting-started checklist and in notifications until
              you save your choice.
            </p>
          </>
        ),
      },
      {
        q: 'How is sales tax handled?',
        aText:
          'Sales tax (GST/HST) is calculated with Stripe Tax on your connected account only after you open Settings → Workshop sales tax and confirm you are registered with the CRA. If you are a small supplier and not registered, leave that off and save — ticket prices will not include GST/HST. When registered, tax is your liability, not the platform’s.',
        a: (
          <p>
            Sales tax (GST/HST) is calculated with <strong>Stripe Tax on your connected
            account</strong> only after you open <strong>Settings → Workshop sales tax</strong> and
            confirm you are registered with the CRA. If you are a small supplier and not registered,
            leave that off and save — ticket prices will not include GST/HST. When registered, tax is
            your liability, not the platform&apos;s.
          </p>
        ),
      },
      {
        q: 'When is tax shown to the customer?',
        aText:
          'Tax is calculated at checkout, not while browsing. The customer sees the base price on the listing with a “Tax calculated at checkout” note; the full subtotal, tax, and total appear in the payment sheet right before they confirm payment.',
        a: (
          <p>
            Tax is calculated <strong>at checkout</strong>, not while browsing. The customer sees
            the base price on the listing with a &ldquo;Tax calculated at checkout&rdquo; note; the
            full subtotal, tax, and total appear in the payment sheet right before they confirm
            payment.
          </p>
        ),
      },
      {
        q: 'Which regions are supported?',
        aText:
          'Canada only at this time. Tax is determined from the customer’s Canadian postal code/province (all provinces and territories are supported).',
      },
    ],
  },
  {
    id: 'workshops',
    title: 'Creating & managing workshops',
    items: [
      {
        q: 'What can I set on a workshop?',
        aText:
          'Title, description, category, price (CAD, $0–$10,000), capacity (1–500 attendees), duration (15–480 min), date, location type (in-person with address, or virtual with a link), and a cover image (falls back to your default image if you don’t upload one).',
        a: (
          <p>
            Title, description, category, price (CAD, $0–$10,000), capacity (1–500 attendees),
            duration (15–480 min), date, location type (<strong>in-person</strong> with address, or{' '}
            <strong>virtual</strong> with a link), and a cover image (falls back to your default
            image if you don&apos;t upload one).
          </p>
        ),
      },
      {
        q: 'Can I run multi-session workshops?',
        aText:
          'Yes. You can create a one-day workshop or a multi-week series (2–12 occurrences). Multi-week comes in two styles: Cohort (same group attends every session; one booking holds a seat across all weeks) and Drop-in / per-occurrence (for repeating-day schedules).',
        a: (
          <>
            <p>
              Yes. You can create a <strong>one-day</strong> workshop or a{' '}
              <strong>multi-week series</strong> (2–12 occurrences). Multi-week comes in two styles:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Cohort</strong> — the same group attends every session; one booking holds a
                seat across all weeks (weekly same-time or custom-time series).
              </li>
              <li>
                <strong>Drop-in / per-occurrence</strong> — for repeating-day schedules.
              </li>
            </ul>
          </>
        ),
      },
      {
        q: 'What are the workshop statuses?',
        aText:
          'Published — live and bookable. Draft — not visible to customers. Fully booked — set automatically when all spots are taken. Archived — soft-deleted/hidden (active bookings auto-refunded on manual archive). Past workshops are archived automatically after the session ends.',
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Published</strong> — live and bookable.
            </li>
            <li>
              <strong>Draft</strong> — not visible to customers.
            </li>
            <li>
              <strong>Fully booked</strong> — set automatically when all spots are taken.
            </li>
            <li>
              <strong>Archived</strong> — soft-deleted/hidden (active bookings auto-refunded on
              archive).
            </li>
          </ul>
        ),
      },
      {
        q: 'Can I account for spots booked outside the app?',
        aText:
          'Yes — you can record an “already booked elsewhere” count so your in-app availability stays accurate.',
      },
    ],
  },
  {
    id: 'calendar',
    title: 'Calendar',
    items: [
      {
        q: 'Can I sync workshops to my calendar?',
        aText:
          'Yes — you can connect Google Calendar or Microsoft Outlook. Published (and fully-booked) workshops with a date/time create calendar events; drafts and archived workshops are removed from your calendar. Multi-week series create one event per session date. Default timezone is America/Toronto.',
        a: (
          <p>
            Yes — you can connect <strong>Google Calendar</strong> or{' '}
            <strong>Microsoft Outlook</strong>. Published (and fully-booked) workshops with a
            date/time create calendar events; drafts and archived workshops are removed from your
            calendar. Multi-week series create one event per session date. Default timezone is
            America/Toronto.
          </p>
        ),
      },
      {
        q: 'Which calendar apps are supported?',
        aText:
          'Google Calendar and Microsoft Outlook. Connect once and all bookings sync automatically in both directions.',
      },
    ],
  },
  {
    id: 'customers',
    title: 'Your customers & where they book',
    items: [
      {
        q: 'Where do customers actually book my workshops?',
        aText:
          'In the offhrs mobile app (iOS and Android). Booking, payment (card, Apple Pay, Google Pay), and booking history all live in the app.',
        a: (
          <p>
            In the <strong>offhrs mobile app</strong> (iOS and Android). Booking, payment (card,
            Apple Pay, Google Pay), and booking history all live in the app.
          </p>
        ),
      },
      {
        q: "Why can't customers book on the website anymore?",
        aText:
          'The web workshop pages (offhrs.app/workshops) are now “get the app” landing pages that drive installs. Existing shared links still work — if someone opens a specific workshop link, they’ll see a page that points them to download the app (and link previews still show the workshop’s name). All consumer booking happens in the app.',
      },
      {
        q: 'Do I have a public presence customers can see?',
        aText:
          'Yes — there’s a vendor page showing your business name, average rating and reviews, and your upcoming workshops. Signed-in customers can leave one review per vendor.',
      },
      {
        q: 'What’s the difference between "vendor-listed" and other workshops?',
        aText:
          'Workshops you create as a partner are vendor-listed and are booked and paid for in-app through your Stripe account. Some listings on the platform are legacy/manually-entered workshops that simply route customers to an external website to book — those don’t process payment through offhrs. Yours, as a partner, are the in-app bookable kind.',
        a: (
          <p>
            Workshops you create as a partner are <strong>vendor-listed</strong> and are booked and
            paid for in-app through your Stripe account. Some listings on the platform are
            legacy/manually-entered workshops that simply route customers to an external website to
            book — those don&apos;t process payment through offhrs. Yours, as a partner, are the
            in-app bookable kind.
          </p>
        ),
      },
    ],
  },
]

/** Flat list of every Q&A (for FAQPage JSON-LD on the marketing page). */
export function flattenPartnerFaqs(): { q: string; a: string }[] {
  return PARTNER_FAQ_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({ q: item.q, a: item.aText }))
  )
}
