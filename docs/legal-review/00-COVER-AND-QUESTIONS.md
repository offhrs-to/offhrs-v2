# offhrs — Legal / tax review package

**Prepared:** October 28, 2026  
**Live site:** https://offhrs.app  
**Policy version date shown on site:** October 28, 2026  

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

- Ontario-based platform; consumer apps + partner dashboard at offhrs.app  
- **Workshops (Lite / Pro):** Stripe Connect Express; 0% platform commission on tickets; Stripe processing ~2.9% + $0.30 CAD borne by vendor; 13% Ontario HST on Stripe SaaS subscriptions  
- **Shopify Sync:** $29 CAD / 30-day trial; billed via **Shopify Billing** (not Stripe); guests book on Shopify checkout; 0% commission by offhrs on those orders  
- **Artist Marketplace:** Canada-only shipping; **3%** platform fee on item subtotal + Stripe processing; prepaid Canada Post labels via Shippo (buyer shipping held by platform for postage); sellers may be GST/HST-registered or not  
- **Decided product tax model (code today):** collect Marketplace GST/HST at checkout **only when the vendor is GST/HST-registered**, into their Connect account; vendor remits. Do **not** collect for unregistered vendors  
- **Refunds:** Stripe processing fee stays with the vendor on refunds (workshops + Marketplace pre–First Scan), same as workshops  
- Partner clickwrap records assent to ToU, Privacy, DPA, and Marketplace Seller Addendum (versioned)

---

## Questions for Ontario counsel (marketplace / e-commerce)

Please review the PDFs and answer (or redline) the following:

1. **Chargebacks / Connect clawbacks** — Are vendor + consumer chargeback / debit / offset clauses enforceable and clear enough for Stripe Connect Express in Canada?  
2. **Risk of loss / shipping** — Is First Scan vs Delivered / insurance allocation fair and clear? Any gap we must disclose more prominently?  
3. **Returns** — Buyer’s-remorse “no returns” vs mandatory damaged / SNAD within 14 days: compliant for Canada (incl. Ontario consumer protection angles)?  
4. **Seller of Record + limited commercial agent** — Is this framing enough for Marketplace goods, or do we need stronger / different language?  
5. **PIPEDA** — Sharing buyer shipping address with sellers; marketing restrictions; account deletion / anonymization of Marketplace orders — any gaps?  
6. **Processors** — Shippo, Canada Post, Stripe, Shopify, hosting, email: adequate disclosure in Privacy / Cookies?  
7. **Quebec / French** — If we sell into QC at scale, what French-language or consumer-law obligations apply, and when must we act?  
8. **Home-based sellers** — For Ontario internet-sale disclosures (seller identity / address shown at checkout), may home-based sellers show a business mailing address instead of a home address?  
9. **Shopify Sync** — Terms now say Sync is billed through **Shopify Billing** (not Stripe). Any consumer/merchant disclosure issues with a dual billing model (Stripe SaaS vs Shopify-billed Sync)?  
10. **Clickwrap** — Is recording ToU / Privacy / DPA / Seller Addendum version + IP / UA / timestamp at signup (and re-accept for existing vendors) adequate assent?

Please return either written approval of the current text or redlines we can apply, then we will bump the policy date and redeploy.

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
