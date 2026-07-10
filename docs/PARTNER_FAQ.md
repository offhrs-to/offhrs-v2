# offhrs Partner FAQ

_Last updated: June 15, 2026_

This FAQ explains how the offhrs partner program works — plans, payouts, fees,
taxes, workshop management, refunds, and where your customers book. It reflects
the current platform behavior, including recent changes (checkout-time tax
calculation and the move of consumer booking to the mobile app).

---

## Getting started

### How do I become a partner?
Sign up through the partner signup wizard. You'll provide your business name,
1–4 workshop categories, your location, an account email and password, and
optionally a website, phone number, and a workshop logo (JPEG/PNG/WebP, up to
2 MB). After you create your account you'll verify your email, then set up
billing.

### Do I have to verify my email?
Yes. New accounts must confirm their email via the link we send before you can
start a plan and access billing. Once verified you're taken straight to the
billing step.

### What happens after I sign up and pay?
Your dashboard walks you through a short checklist:

1. Verify email
2. Start your free trial
3. Connect your Stripe payout account
4. Review settings and add a bio
5. Connect a calendar (Google or Outlook)
6. Create your first workshop

---

## Plans & billing

### What does it cost to list on offhrs?
There are two monthly plans (CAD):

| Plan | Price | Active workshops |
| ---- | ----- | ---------------- |
| **Lite** | $29 / month | Up to 4 at a time |
| **Pro**  | $49 / month | Unlimited |

### Is there a free trial?
Yes — a **30-day free trial**. You won't be charged until the trial ends.

### How is billing handled?
Billing runs through Stripe subscription checkout (with automatic tax and
tax-ID collection where applicable). Your subscription status (trialing, active,
past due, etc.) syncs automatically, so if a payment fails or you cancel, your
account reflects it.

### What's the difference between Lite and Pro?
Lite caps you at 4 concurrently active (non-archived) workshops. Pro removes
that cap. If you're on Lite and hit the limit, archive an old workshop or
upgrade to Pro to add more.

---

## Getting paid (payouts & fees)

### How do I get paid for bookings?
Through **Stripe Connect (Express)**. You'll set up a Canadian payout account
from your dashboard. When a customer books and pays in the app, the charge is
sent on your behalf and the funds are routed to your connected Stripe account.

> **You must finish Stripe Connect onboarding before any payouts can be
> released.** You can view your payout history (amounts and arrival dates) in
> the dashboard once it's connected.

### Does offhrs take a commission on each booking?
No — offhrs does **not** take a percentage commission on bookings. Our revenue
is the monthly subscription. What does apply to every paid booking is the
standard **Stripe payment processing fee (about 2.9% + $0.30 CAD per
transaction)**, which is borne by you as the vendor (this is standard for any
Stripe-based checkout).

### When do payouts arrive?
Payouts are issued by Stripe on Stripe's standard schedule for your account.
You can track each payout's status and expected arrival date in the dashboard.

---

## Refunds & cancellations

### Who absorbs the processing fee when a booking is refunded?
The vendor does. In Canada, Stripe does not return the original processing fee
when a charge is refunded. When you (or a customer) refund a booking, the funds
are pulled back from your connected account and the original processing fee is
not recovered — so the vendor absorbs that fee. This is by design and is
disclosed in our terms.

### How does the cancellation/refund window work?
Each workshop has a **refund window** — the cutoff (in hours before the session
starts) for a full refund. The default is **48 hours**. Customers who cancel
before the cutoff get a full refund automatically; after the cutoff, they're
told that cancellations with a full refund must be made at least X hours before
the session.

### Can I change my refund window?
Yes, in your settings. You can set anything from a minimum of **24 hours**
(platform policy) up to **8,760 hours (1 year)**.

### What happens to existing bookings if I archive/delete a workshop?
Archiving is a soft delete. When you archive a workshop, any active bookings on
it are automatically refunded, and the workshop is hidden from customers.

---

## Taxes

### How is sales tax handled?
Sales tax (GST/HST) is calculated with **Stripe Tax on your connected
account**, meaning the tax is collected under your registration and is your tax
liability — not the platform's. When you connect your payout account, we attempt
to set up your Canadian GST/HST tax registration automatically.

### When is tax shown to the customer?
Tax is calculated **at checkout**, not while browsing. The customer sees the
base price on the listing with a "Tax calculated at checkout" note; the full
subtotal, tax, and total appear in the payment sheet right before they confirm
payment.

### Which regions are supported?
Canada only at this time. Tax is determined from the customer's Canadian postal
code/province (all provinces and territories are supported).

---

## Creating & managing workshops

### What can I set on a workshop?
Title, description, category, price (CAD, $0–$10,000), capacity (1–500
attendees), duration (15–480 min), date, location type (**in-person** with
address, or **virtual** with a link), and a cover image (falls back to your
default image if you don't upload one).

### Can I run multi-session workshops?
Yes. You can create a **one-day** workshop or a **multi-week series** (2–12
occurrences). Multi-week comes in two styles:

- **Cohort** — the same group attends every session; one booking holds a seat
  across all weeks (weekly same-time or custom-time series).
- **Drop-in / per-occurrence** — for repeating-day schedules.

### What are the workshop statuses?
- **Published** — live and bookable.
- **Draft** — not visible to customers.
- **Fully booked** — set automatically when all spots are taken.
- **Archived** — soft-deleted/hidden (active bookings auto-refunded on archive).

### Can I account for spots booked outside the app?
Yes — you can record an "already booked elsewhere" count so your in-app
availability stays accurate.

---

## Calendar

### Can I sync workshops to my calendar?
Yes — you can connect **Google Calendar** or **Microsoft Outlook**. Published
(and fully-booked) workshops with a date/time create calendar events; drafts
and archived workshops are removed from your calendar. Multi-week series create
one event per session date. Default timezone is America/Toronto.

---

## Your customers & where they book

### Where do customers actually book my workshops?
In the **offhrs mobile app** (iOS and Android). Booking, payment (card, Apple
Pay, Google Pay), and booking history all live in the app.

### Why can't customers book on the website anymore?
The web workshop pages (`offhrs.app/workshops`) are now "get the app" landing
pages that drive installs. Existing shared links still work — if someone opens a
specific workshop link, they'll see a page that points them to download the app
(and link previews still show the workshop's name). All consumer booking happens
in the app.

### Do I have a public presence customers can see?
Yes — there's a vendor page showing your business name, average rating and
reviews, and your upcoming workshops. Signed-in customers can leave one review
per vendor.

### What's the difference between "vendor-listed" and other workshops I might see?
Workshops you create as a partner are **vendor-listed** and are booked and paid
for in-app through your Stripe account. Some listings on the platform are
legacy/manually-entered workshops that simply route customers to an external
website to book — those don't process payment through offhrs. Yours, as a
partner, are the in-app bookable kind.

---

## Account & deletion

### How do I delete my partner account?

In **Settings**, use **Delete vendor account**. This cancels your subscription
immediately, refunds active paid customer bookings, and permanently removes your
vendor profile, workshops, booking records, payout history in offhrs, and
calendar connections. If you use the same email in the mobile app, your consumer
account is kept.

**Before you delete:**

1. **Check Stripe Express** (Payouts) for any balance or pending payouts. Bank
   payouts continue on Stripe's schedule even after you leave offhrs; you lose
   payout history in the offhrs dashboard.
2. **Confirm you are okay refunding upcoming paid bookings** — deletion refunds
   active paid bookings automatically.
3. **Export your Bookings CSV** if you need records; offhrs cannot recover data
   after deletion.

---

_Questions this FAQ doesn't cover? Contact the offhrs team and we'll help._
