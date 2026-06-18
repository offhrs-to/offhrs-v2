import type { Metadata } from 'next'
import { ChevronDown } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Partner FAQ',
  description:
    'Answers to common partner questions about plans, payouts, fees, taxes, refunds, and managing your workshops on offhrs.',
}

type QA = { q: string; a: React.ReactNode }
type Section = { id: string; title: string; items: QA[] }

const SECTIONS: Section[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    items: [
      {
        q: 'How do I become a partner?',
        a: (
          <p>
            Sign up through the partner signup wizard. You&apos;ll provide your business name,
            1–4 workshop categories, your location, an account email and password, and optionally a
            website, phone number, and a workshop logo (JPEG/PNG/WebP, up to 2&nbsp;MB). After you
            create your account you&apos;ll verify your email, then set up billing.
          </p>
        ),
      },
      {
        q: 'Do I have to verify my email?',
        a: (
          <p>
            Yes. New accounts must confirm their email via the link we send before you can start a
            plan and access billing. Once verified you&apos;re taken straight to the billing step.
          </p>
        ),
      },
      {
        q: 'What happens after I sign up and pay?',
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
        a: (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[#555]">
                  <th className="py-2 pr-4 font-semibold">Plan</th>
                  <th className="py-2 pr-4 font-semibold">Price</th>
                  <th className="py-2 font-semibold">Active workshops</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[#E8E4DE]">
                  <td className="py-2 pr-4 font-medium text-[#1a1a1a]">Lite</td>
                  <td className="py-2 pr-4">$29 / month (CAD)</td>
                  <td className="py-2">Up to 4 at a time</td>
                </tr>
                <tr className="border-t border-[#E8E4DE]">
                  <td className="py-2 pr-4 font-medium text-[#1a1a1a]">Pro</td>
                  <td className="py-2 pr-4">$49 / month (CAD)</td>
                  <td className="py-2">Unlimited</td>
                </tr>
              </tbody>
            </table>
          </div>
        ),
      },
      {
        q: 'Is there a free trial?',
        a: (
          <p>
            Yes — a <strong>30-day free trial</strong>. You won&apos;t be charged until the trial
            ends.
          </p>
        ),
      },
      {
        q: 'How is billing handled?',
        a: (
          <p>
            Billing runs through Stripe subscription checkout (with automatic tax and tax-ID
            collection where applicable). Your subscription status (trialing, active, past due,
            etc.) syncs automatically, so if a payment fails or you cancel, your account reflects
            it.
          </p>
        ),
      },
      {
        q: "What's the difference between Lite and Pro?",
        a: (
          <p>
            Lite caps you at 4 concurrently active (non-archived) workshops. Pro removes that cap.
            If you&apos;re on Lite and hit the limit, archive an old workshop or upgrade to Pro to
            add more.
          </p>
        ),
      },
    ],
  },
  {
    id: 'payouts-fees',
    title: 'Getting paid (payouts & fees)',
    items: [
      {
        q: 'How do I get paid for bookings?',
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
        a: (
          <p>
            No — offhrs does <strong>not</strong> take a percentage commission on bookings. Our
            revenue is the monthly subscription. What does apply to every paid booking is the
            standard <strong>Stripe payment processing fee (about 2.9% + $0.30 CAD per
            transaction)</strong>, which is borne by you as the vendor (this is standard for any
            Stripe-based checkout).
          </p>
        ),
      },
      {
        q: 'When do payouts arrive?',
        a: (
          <p>
            Payouts are issued by Stripe on Stripe&apos;s standard schedule for your account. You
            can track each payout&apos;s status and expected arrival date in the dashboard.
          </p>
        ),
      },
    ],
  },
  {
    id: 'refunds',
    title: 'Refunds & cancellations',
    items: [
      {
        q: 'Who absorbs the processing fee when a booking is refunded?',
        a: (
          <p>
            The vendor does. In Canada, Stripe does not return the original processing fee when a
            charge is refunded. When you (or a customer) refund a booking, the funds are pulled back
            from your connected account and the original processing fee is not recovered — so the
            vendor absorbs that fee. This is by design and is disclosed in our terms.
          </p>
        ),
      },
      {
        q: 'How does the cancellation/refund window work?',
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
        a: (
          <p>
            Yes, in your settings. You can set anything from a minimum of <strong>24 hours</strong>{' '}
            (platform policy) up to <strong>8,760 hours (1 year)</strong>.
          </p>
        ),
      },
      {
        q: 'What happens to existing bookings if I archive a workshop?',
        a: (
          <p>
            Archiving is a soft delete. When you archive a workshop, any active bookings on it are
            automatically refunded, and the workshop is hidden from customers.
          </p>
        ),
      },
    ],
  },
  {
    id: 'taxes',
    title: 'Taxes',
    items: [
      {
        q: 'Where do I set my GST/HST status?',
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
        a: (
          <p>
            Canada only at this time. Tax is determined from the customer&apos;s Canadian postal
            code/province (all provinces and territories are supported).
          </p>
        ),
      },
    ],
  },
  {
    id: 'workshops',
    title: 'Creating & managing workshops',
    items: [
      {
        q: 'What can I set on a workshop?',
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
        a: (
          <p>
            Yes — you can record an &ldquo;already booked elsewhere&rdquo; count so your in-app
            availability stays accurate.
          </p>
        ),
      },
    ],
  },
  {
    id: 'calendar',
    title: 'Calendar',
    items: [
      {
        q: 'Can I sync workshops to my calendar?',
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
    ],
  },
  {
    id: 'customers',
    title: 'Your customers & where they book',
    items: [
      {
        q: 'Where do customers actually book my workshops?',
        a: (
          <p>
            In the <strong>offhrs mobile app</strong> (iOS and Android). Booking, payment (card,
            Apple Pay, Google Pay), and booking history all live in the app.
          </p>
        ),
      },
      {
        q: "Why can't customers book on the website anymore?",
        a: (
          <p>
            The web workshop pages (offhrs.app/workshops) are now &ldquo;get the app&rdquo; landing
            pages that drive installs. Existing shared links still work — if someone opens a specific
            workshop link, they&apos;ll see a page that points them to download the app (and link
            previews still show the workshop&apos;s name). All consumer booking happens in the app.
          </p>
        ),
      },
      {
        q: 'Do I have a public presence customers can see?',
        a: (
          <p>
            Yes — there&apos;s a vendor page showing your business name, average rating and reviews,
            and your upcoming workshops. Signed-in customers can leave one review per vendor.
          </p>
        ),
      },
      {
        q: 'What\u2019s the difference between "vendor-listed" and other workshops?',
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

export default function PartnerFaqPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-[#1a1a1a]">Partner FAQ</h1>
        <p className="text-sm text-[#555] mt-2 leading-relaxed">
          Answers to common questions about plans, payouts, fees, taxes, refunds, and managing your
          workshops on offhrs. Still stuck? Reach out to the offhrs team and we&apos;ll help.
        </p>
      </header>

      <div className="space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.id} aria-labelledby={`faq-${section.id}`}>
            <h2
              id={`faq-${section.id}`}
              className="text-xs font-semibold uppercase tracking-wide text-[#5D755D] mb-3"
            >
              {section.title}
            </h2>
            <div className="space-y-2">
              {section.items.map((item, idx) => (
                <details
                  key={idx}
                  className="group bg-white border border-[#E8E4DE] rounded-xl overflow-hidden"
                >
                  <summary className="flex items-center justify-between gap-3 cursor-pointer list-none px-4 py-3.5 text-sm font-medium text-[#1a1a1a] hover:bg-[#FAFAF8] transition-colors">
                    <span>{item.q}</span>
                    <ChevronDown className="w-4 h-4 flex-shrink-0 text-[#888] transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-4 pb-4 pt-0 text-sm text-[#555] leading-relaxed">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
