# offhrs — Legal / tax review package

**Prepared:** November 1, 2026  
**Live site:** https://offhrs.app  
**Policy version date shown on site:** November 1, 2026  
**Partner portal:** https://partners.offhrs.app (same app as https://offhrs.app/partners)

**Not legal or tax advice.** This cover note is for counsel / CPA engagement only.

## Documents in this package (PDFs)

| # | Document | Live URL |
|---|----------|----------|
| 1 | Terms of Use | https://offhrs.app/terms/terms-of-use |
| 2 | Privacy Policy | https://offhrs.app/terms/privacy-policy |
| 3 | Service Terms | https://offhrs.app/terms/service-terms |
| 4 | Data Protection Addendum | https://offhrs.app/terms/data-protection |
| 5 | Cookie Policy | https://offhrs.app/terms/cookies |
| 6 | Content Policy | https://offhrs.app/terms/content-policy |
| 7 | Marketplace Seller Addendum | https://offhrs.app/terms/marketplace-seller-addendum |

Also useful context (not legal text): https://offhrs.app/partners/shopify-sync

## Product facts (for the engagement)

- Ontario-based platform; consumer apps + partner dashboard at `partners.offhrs.app`
- **Workshops (Lite / Pro):** Stripe Connect Express; 0% platform commission on tickets; Stripe’s standard card fee currently **2.9% + CA$0.30** per successful domestic-card transaction (as published by Stripe; international cards may cost more), borne by vendor; 13% Ontario HST on Stripe SaaS subscriptions
- **Shopify Sync:** $29 CAD / 30-day trial; billed via **Shopify Billing** (not Stripe); guests book on Shopify checkout; 0% commission by offhrs on those orders; uninstalling the app cancels Sync billing via Shopify
- **Artist Marketplace:** Canada-only shipping; **3%** platform fee on item subtotal + Stripe processing; prepaid Canada Post labels via Shippo (buyer shipping held by platform for postage); sellers may be GST/HST-registered or not
- **Decided product tax model (code today):** collect Marketplace GST/HST at checkout **only when the vendor is GST/HST-registered**, into their Connect account; vendor remits. Do **not** collect for unregistered vendors. Shipping postage is held by the platform; GST/HST for registered vendors is **paid out** to the vendor to remit (not conflated with shipping)
- **Marketplace cancellations:** Buyer may self-cancel from **Profile → Orders** before carrier First Scan (or before pickup completion) for an automatic full refund; seller and offhrs may also refund in that window. After First Scan, cancel/refund is blocked; damaged / SNAD claims within 14 days
- **Refunds:** Stripe processing fee stays with the vendor on refunds (workshops + Marketplace pre–First Scan), same as workshops
- **Phone / notices:** Mobile numbers are optional; transactional notices are email (Resend), not SMS
- **Retention:** Transaction / tax fields retained up to six (6) years for CRA; no automated purge cron today (records kept). Partner post-termination: Bookings CSV export in dashboard; Marketplace/client exports on request to hello@offhrs.app within 30 days
- Partner clickwrap records assent to ToU, Privacy, Service Terms, DPA, Cookies, Content Policy, and Marketplace Seller Addendum (versioned)

## What’s new in this November 1 pack (vs October 28)

1. Stripe fee language aligned to Stripe Canada published wording (2.9% + CA$0.30 domestic)
2. Buyer Marketplace self-cancel (Profile → Orders) reflected in ToU, Service Terms, Seller Addendum, and checkout disclosures
3. DPA: optional mobile numbers; no automated SMS; export window clarified (Bookings CSV + email request)
4. Confirmed: no Full License plan; Marketplace platform fee is **3%** (not 5%)
5. Partner portal URL remains **partners.offhrs.app**

---

## Questions for Ontario counsel (marketplace / e-commerce)

Please review the PDFs and answer (or redline) the following:

1. **Chargebacks / Connect clawbacks** — Are vendor + consumer chargeback / debit / offset clauses enforceable and clear enough for Stripe Connect Express in Canada?  
2. **Risk of loss / shipping** — Is First Scan vs Delivered / insurance allocation fair and clear? Any gap we must disclose more prominently?  
3. **Returns** — Buyer’s-remorse “no returns” vs mandatory damaged / SNAD within 14 days: compliant for Canada (incl. Ontario consumer protection angles)?  
4. **Buyer self-cancel before First Scan** — Is the Profile → Orders cancel + auto full refund path adequately disclosed for Ontario internet agreements / CPA?  
5. **Seller of Record + limited commercial agent** — Is this framing enough for Marketplace goods, or do we need stronger / different language?  
6. **PIPEDA** — Sharing buyer shipping address with sellers; marketing restrictions; account deletion / anonymization of Marketplace orders — any gaps?  
7. **Processors** — Shippo, Canada Post, Stripe, Shopify, hosting, email: adequate disclosure in Privacy / Cookies?  
8. **Quebec / French** — If we sell into QC at scale, what French-language or consumer-law obligations apply, and when must we act?  
9. **Home-based sellers** — For Ontario internet-sale disclosures (seller identity / address shown at checkout), may home-based sellers show a business mailing address instead of a home address?  
10. **Shopify Sync** — Terms say Sync is billed through **Shopify Billing** (not Stripe). Any consumer/merchant disclosure issues with a dual billing model (Stripe SaaS vs Shopify-billed Sync)?  
11. **Clickwrap** — Is recording ToU / Privacy / DPA / Seller Addendum (and related policies) version + IP / UA / timestamp at signup (and re-accept for existing vendors) adequate assent?  
12. **Data retention** — Stating retention “up to six years” for CRA while keeping records indefinitely (no purge job) — any issue, or should we commit to a hard deletion schedule?

Please return either written approval of the current text or redlines we can apply, then we will bump the policy date if needed and redeploy.

---

## Questions for CPA / tax counsel (GST/HST)

Please answer in writing:

1. Are we a **distribution platform operator** / marketplace facilitator for qualifying goods under the Excise Tax Act digital-economy rules?  
2. Do third-party Marketplace sales create GST/HST duties for offhrs when the **seller is not registered**?  
3. Confirm or reject our **current build**: collect GST/HST only for **registered** vendors into their Connect account (vendor remits); do **not** collect for unregistered vendors. Should we instead collect on **all** Marketplace sales?  
4. Is the **3% platform fee** taxable to registered vendors / how should we treat it?  
5. How should we **remit** (which return lines, timing, ITCs) for SaaS HST we already charge vs any Marketplace facilitator amounts?  
6. Any **PST/QST** issues for BC / SK / MB / QC if buyers are there (Canada-only ship)?  
7. Confirm Stripe Tax goods code **`txcd_99999999` (General – Tangible Goods)** is appropriate for mixed craft / art / goods, or name a better code.

Until we have this opinion: keep Marketplace GMV and live label volume small; do not scale national paid acquisition for Shop.
