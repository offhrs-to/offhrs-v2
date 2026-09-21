# App Store listing draft — offhrs (Sales Channel)

Copy for Partner Dashboard → App listing. Paste when Phase 1+ is deployable; do **not** resubmit until Phases 1–3 work end-to-end.

**Category:** Sales Channel  
**App name:** offhrs  
**Subtitle (tagline):** Publish workshop products to offhrs — guests discover locally and book on Shopify checkout.

---

## App introduction (short)

offhrs is a local discovery app for in-person workshops. Merchants publish workshop products from Shopify Admin to the offhrs sales channel. Guests browse sessions in the offhrs mobile app, then complete booking and payment on Shopify checkout. Shopify stays the source of truth for products, inventory, and orders — no re-entering workshops into another dashboard.

---

## Detailed description

**Publish workshops to offhrs so local customers can discover them and book on your store.**

- Connect your Shopify store and offhrs partner account from the sales channel in Admin  
- Publish workshop products to the offhrs channel (variants = session times; inventory = seats left)  
- Keep listings updated when products or stock change  
- Send guests to Shopify checkout with the session pre-loaded in cart  
- Manage connection, plan, and disconnect from the offhrs sales channel in Shopify Admin  

**Pricing**

Shopify Sync: **$29 CAD/month** with a **30-day free trial**. Billed on your Shopify invoice via Shopify App Pricing / Billing API.  
offhrs does **not** take a commission on synced workshop bookings (0% platform fee on Sync bookings). Guests pay you on Shopify.

**What Sync does not do**

- Does not process payment inside offhrs for synced workshops  
- Does not replace Shopify Admin as the place you edit products  
- Does not unlock native offhrs Lite/Pro booking or Stripe ticket sales (those are separate plans)

---

## Feature bullets (listing UI)

1. Publish Shopify workshop products to the offhrs discovery app  
2. Map variants to session times with inventory-based availability  
3. Keep listings in sync when products or stock change  
4. Send customers to Shopify checkout to complete booking  
5. Connect, bill, and disconnect from Shopify Admin  

---

## Pricing section (listing)

| Plan | Price | Trial |
|---|---|---|
| Shopify Sync | $29 CAD / 30 days | 30-day free trial |

**Fees / commission:** $29 CAD/month subscription. **0%** commission on synced workshop checkout orders.

---

## Demo screencast outline (English)

Record after Phase 3. Target 3–5 minutes. Show a partner development store.

1. Install **offhrs** from Admin / App Store → lands in **Sales channels → offhrs**  
2. **Connect** offhrs account (sign in / sign up) via Account Connection  
3. Approve **Shopify Sync** billing ($29 CAD, trial)  
4. Open a workshop product → set session datetime on each variant (see examples below) → **Publish to offhrs**  
5. Show product appear in offhrs (web preview or mobile)  
6. Tap **Book on Shopify** → cart with correct variant → checkout  
7. Optional: disconnect channel without contacting support  

Provide **test credentials** in the review notes: offhrs partner login + any MFA notes + which product to publish.

---

## Review notes (paste into submission)

- App is a **Sales Channel** (cart-permalink model). Guests discover on offhrs and check out on Shopify.  
- Merchants do **not** re-enter workshop catalog in our Partners dashboard; they **publish** products to the offhrs channel from Shopify Admin.  
- Billing uses Shopify Billing API (`appSubscriptionCreate`) — $29 CAD/month, 30-day trial. **0%** commission on Sync bookings.  
- Canada / CAD focused channel (`offhrs-ca`); store should have a Canada market with Online Store for channel connection.  
- Test shop: `offhrs-sync-review.myshopify.com` (dev store — storefront password required for cart).  
- Test partner login: `[fill]`. Password: `[fill]`. MFA: `[fill or “disabled for review account”]`.  
- Staff / Admin login for the test shop: `[fill]`. Storefront password: `[fill]`.  
- Demo workshop product handle: `[fill]` — publish to **offhrs**, then Sync.  
- **Session datetime on variants (required for Sync):** each workshop variant needs a full date **and** time (America/Toronto). Preferred: add a product option named **Date** (or Date & time / Session) and set each variant’s option value to a parseable datetime. Examples that work:
  - `September 30, 2026 12:00 PM`
  - `Oct 15, 2026 6:30 PM`
  - `2026-11-01 14:00`
  - Or metafield `offhrs.starts_at` on the variant / product (ISO datetime).  
  Without a parseable datetime, Sync skips the product and Admin shows ResourceFeedback asking for a session date/time.  
- After Book on Shopify, order should attribute to the **offhrs** sales channel (storefront access token on cart permalink).  
- Year-one onboarding plan: Greater Toronto / Canada workshop studios via App Store + partner outreach (see Phase 0 ops).  
- Scope upgrade note: existing installs may need **Approve new scopes** for `unauthenticated_read_product_listings` (cart attribution).  
- Ready for Shopify to add `read_only_own_orders` during sales-channel review.  

### Your pre-submit checklist (ops)

1. [ ] Record screencast (outline above) and upload to Partner Dashboard  
2. [ ] Fill all `[fill]` credentials above into App Store review notes  
3. [ ] Emergency developer contact saved in Partner account settings  
4. [ ] Upload 16×16 nav icon (`public/shopify/offhrs-channel-nav-icon.svg`)  
5. [ ] Listing category = **Sales Channel**; paste listing copy from this doc  
6. [ ] Dry-run: publish → appear → Book → checkout; unpublish stays archived; order shows offhrs attribution  
7. [ ] Confirm `shopify app deploy` so channel_config is live under Sales channels  

---

## Do / don’t (listing language)

**Do say:** publish, sales channel, discover on offhrs, book on Shopify checkout, inventory sync  

**Don’t say:** “regular sync app,” “tag products,” “enter workshops in our dashboard,” “checkout inside offhrs,” “bypass Shopify billing”
