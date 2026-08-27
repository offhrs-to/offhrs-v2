# Artist Marketplace — Phase 0 ops checklist

Step-by-step for humans (founder / counsel / accountant). Engineering scaffolding is already in the repo; these steps unblock **live** checkout.

**Not legal or tax advice.** Confirm CRA steps with your accountant/lawyer.

---

## 1. Shippo account → Canada Post → `SHIPPO_API_KEY` in Vercel

### 1.1 Create Shippo account

1. Go to [https://goshippo.com](https://goshippo.com) → **Sign up**.
2. Use a company email (e.g. `hello@offhrs.app` or `ops@…`).
3. Complete company profile: legal name, Canada address (your business / ops address), phone.
4. Choose **API** / developer access if prompted (you need API keys, not only the web app).
5. Add a **payment method** on Shippo (credit card or billing). Postage and per-label API fees are charged to **your** Shippo account when labels are bought (buyer shipping at checkout reimburses postage).

### 1.2 Enable Canada Post (Shippo’s carrier account — recommended for v1)

Use **Shippo’s Canada Post account** (instant discounted rates; no separate CP commercial app required for v1):

1. In Shippo: **Settings** (gear) → **Carriers**.
2. Find **Canada Post**.
3. Click **Activate Account** (or equivalent).
4. Confirm contact / address details.
5. Agree to Canada Post terms → **Submit**.
6. Confirm Canada Post shows as **active** and rates appear for a test CA → CA shipment in the Shippo UI.

Official guide: [How to Add Shippo's Canada Post Carrier Account](https://support.goshippo.com/hc/en-us/articles/4403267961499-How-to-Add-Shippo-s-Canada-Post-Carrier-Account).

**Optional later:** connect your **own** Canada Post business account (Settings → Carriers → Connect Carrier Account → Canada Post → OAuth login). Not required for platform-funded labels in v1.

**Note:** Our product is **Canada-only**. Do not enable US shipping flows; ignore Zonos/DDP US setup.

### 1.3 Get API keys (this *is* Shippo “test mode”)

There is **no** Stripe-style **Test mode** toggle on the Shippo shipping UI. Test vs live is entirely which **API key** you use.

1. Open API keys: [https://portal.goshippo.com/api-config/api](https://portal.goshippo.com/api-config/api)  
   (or apps.goshippo.com → **Settings** → **Advanced** → **API**).
2. Under **Developer Keys** / **Test keys** → **Create new test key**.
3. Copy the key once — it starts with `shippo_test_…`. Store it; Shippo won’t show the full value again.
4. Later for production: **Create new live key** → `shippo_live_…` (real postage charges).
5. Never commit keys to git.

### 1.4 Smoke-test rates (Shippo web UI is fine with live carriers)

You do **not** need a test toggle to check Canada Post rates in the browser:

1. In Shippo, create a sample shipment: origin Toronto postal, destination another ON postal, weight ~1 kg, small box dims.
2. Confirm **Canada Post** rates return (Regular / Expedited / Xpresspost as enabled).
3. **Do not buy a real label** in the UI unless you want to be charged — use the web UI only to verify rates appear.
4. API test labels (no charge) happen later in Phase 2 when the app calls Shippo with `shippo_test_…`.

### 1.5 Add `SHIPPO_API_KEY` to Vercel

1. Open [Vercel](https://vercel.com) → project for **offhrs** (production).
2. **Settings** → **Environment Variables**.
3. Add:
   - **Key:** `SHIPPO_API_KEY`
   - **Value:** `shippo_test_…` on Preview / Development; `shippo_live_…` on Production when go-live.
   - Scope: Production (and Preview if you test shipping on preview URLs).
4. **Save** → **Redeploy** production so the new env is picked up.
5. Do **not** set `NEXT_PUBLIC_SHIPPO_*` — key must stay server-only.

### 1.6 Done when

- [ ] Canada Post active in Shippo  
- [ ] Test rates work in Shippo UI  
- [ ] `SHIPPO_API_KEY` set in Vercel (test and/or live)  
- [ ] Redeploy completed  

---

## 2. Counsel review of the new Terms / addendum

### 2.1 What to send counsel

Package these live (or staged) URLs / files:

| Document | Path / URL |
|----------|------------|
| Terms of Use | `https://offhrs.app/terms/terms-of-use` |
| Service Terms | `https://offhrs.app/terms/service-terms` |
| Privacy Policy | `https://offhrs.app/terms/privacy-policy` |
| Content Policy | `https://offhrs.app/terms/content-policy` |
| Data Protection | `https://offhrs.app/terms/data-protection` |
| **Marketplace Seller Addendum** | `https://offhrs.app/terms/marketplace-seller-addendum` |
| Product plan (context) | `docs/ARTIST_SHOP_MARKETPLACE_PLAN.md` |

Ask for an **Ontario / Canadian** lawyer familiar with marketplaces, e-commerce, and GST/HST.

### 2.2 What to ask them to review (checklist for the engagement letter)

1. Chargeback / Connect clawback language (vendor + consumer).  
2. Risk of loss: First Scan vs Delivered; insurance gap on seller.  
3. Returns: buyer’s remorse “no returns” vs mandatory damaged/SNAD (14 days).  
4. Marketplace facilitator tax wording vs your actual remittance model.  
5. PIPEDA: sharing shipping address with sellers; marketing prohibition.  
6. Shippo as processor disclosure.  
7. Whether “Seller of Record” + limited commercial agent language is enough.  
8. Any Quebec / French language requirements if you sell into QC at scale.  

### 2.3 After counsel

1. Collect redlines or written OK.  
2. Apply approved edits to `src/app/terms/**` (or ask engineering).  
3. Bump `POLICY_LAST_UPDATED` in `src/lib/policy-pages.ts`.  
4. Deploy.  
5. Keep a PDF of the signed/approved versions dated for your records.

### 2.4 Done when

- [ ] Counsel engagement started  
- [ ] Written approval or redlines applied  
- [ ] Deployed Terms match approved text  

---

## 3. CRA marketplace facilitator registration / remittance

**Context:** offhrs is an Ontario-based platform that will facilitate payment for **tangible goods** already in Canada. Obligations depend on residency, thresholds, and whether sales are attributed to you as a **distribution platform operator**. This is **accountant/lawyer territory** — do not rely on this checklist alone.

### 3.1 Gather facts for your accountant

Write a one-pager:

- Legal entity name, BN (if any), Ontario address  
- You already charge **HST on Lite/Pro SaaS** subscriptions  
- New line of business: Artist Marketplace, CAD, Canada-only shipping  
- Sellers may be GST/HST-registered **or** small suppliers / hobbyists  
- Platform takes **5%** + processes payment via Stripe Connect  
- Plan: calculate/collect tax at checkout with **Stripe Tax**  

### 3.2 Confirm with accountant/counsel

Ask explicitly:

1. Are we a **distribution platform operator** / marketplace facilitator for **qualifying goods** under the Excise Tax Act digital-economy measures?  
2. Do **third-party Marketplace sales** count toward our GST/HST registration / remittance duties when the seller is **not** registered?  
3. Should we collect GST/HST on **all** Marketplace sales via the platform (recommended build), or only when the seller is unregistered?  
4. How do we **remit** (which GST/HST return line, timing, ITCs)?  
5. Any **PST** issues for BC/SK/MB if buyers are there (Canada-only ship)?  

Official starting points:

- [GST/HST for digital economy businesses (Canada.ca)](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/digital-economy-gsthst.html)  
- [Stripe: Understanding tax obligations of marketplaces in Canada](https://stripe.com/guides/understanding-the-tax-obligations-of-marketplaces-in-canada)  

### 3.3 If registration / account changes are required

Typical path for a **Canadian resident** already in business (high level):

1. Log into **CRA My Business Account**.  
2. Confirm you have a **GST/HST program account** (RT) on your BN — you likely already do for Partners SaaS.  
3. If advised to register or expand: follow CRA “Register for a GST/HST account” / update business activities to include facilitating supplies of goods.  
4. Note **effective date** of any new obligations.  
5. Set calendar reminders for **GST/HST filing** (monthly/quarterly/annual as assigned).  
6. Document who remits Marketplace tax vs seller-remitted workshop tax (different flows).

### 3.4 Align Stripe Tax with the decision

1. Stripe Dashboard → **Tax** → ensure **Tax** is enabled.  
2. Add / confirm **Canada GST/HST registrations** matching what CRA requires (province registrations as advised).  
3. Origin / head office address = Canada.  
4. Tell engineering the remittance model (platform remits Marketplace tax vs pass-through) so checkout metadata and reporting match.

### 3.5 Done when

- [ ] Accountant/lawyer written opinion on facilitator duties  
- [ ] CRA accounts updated if required  
- [ ] Stripe Tax registrations match that opinion  
- [ ] Remittance process documented (who files what)  

---

## 4. Set `STRIPE_SHOP_GOODS_TAX_CODE` (Stripe Tax)

Engineering default placeholder is already `txcd_99999999` (**General - Tangible Goods**), which Stripe documents as appropriate for most physical goods. You still should **confirm** in Dashboard and set the env explicitly.

### 4.1 Confirm the code (docs — not a Dashboard button)

There is **no** “confirm txcd” screen in Stripe Dashboard. Product tax codes live in Stripe’s **docs list**; checkout will pass the code from your Vercel env.

1. Open [Stripe Tax codes — physical goods](https://docs.stripe.com/tax/tax-codes?type=physical).  
2. Find **`txcd_99999999` — General - Tangible Goods** (“A physical good that can be moved or touched”). That is the confirm step.  
3. Optional: if you later sell a narrow category with special rules (e.g. clothing), pick a more specific code; for mixed ceramics/art/prints, **general tangible** is the usual v1 choice.  
4. You do **not** need to create a Stripe Product with this code for Phase 0 — engineering will set `tax_code` on Marketplace Checkout Sessions in Phase 2.

### 4.2 Ensure Tax is ready for Canada physical goods

1. Stripe Dashboard → **Settings** → **Tax** (or Tax app).  
2. Enable Stripe Tax if not already (you use it for workshops).  
3. Under **Registrations**, confirm **Canada GST/HST** (and any provincial registrations your accountant required).  
4. Head office / origin address in Canada.  
5. For Marketplace, tax will be calculated using the **buyer shipping address** (not workshop venue) — engineering will pass that in Phase 2.

### 4.3 Set the env var in Vercel

1. Vercel → offhrs project → **Settings** → **Environment Variables**.  
2. Add or update:
   - **Key:** `STRIPE_SHOP_GOODS_TAX_CODE`  
   - **Value:** `txcd_99999999` (or the code counsel/accountant approved)  
   - Environments: Production + Preview  
3. Optional (already may exist for workshops):
   - `STRIPE_WORKSHOP_TAX_CODE` = existing workshop/services code  
4. Redeploy.

Repo reference: `src/lib/shop/tax-constants.ts` reads `STRIPE_SHOP_GOODS_TAX_CODE`.

### 4.4 Done when

- [ ] Code confirmed against Stripe’s physical goods list  
- [ ] `STRIPE_SHOP_GOODS_TAX_CODE` set in Vercel  
- [ ] Canada tax registrations active in Stripe Tax  
- [ ] Redeploy done  

---

## Suggested order of operations

1. **Shippo** (unblocks Phase 2 rate/label work in staging with test key)  
2. **Stripe tax code + Tax registrations** (unblocks tax calculation design)  
3. **Accountant/CRA** (may take longest — start early)  
4. **Counsel** on Terms (can overlap with 1–3)  

Phase 1 (Products CRUD) can proceed **without** Shippo live key; Phase 2 checkout should not go to production without 1–4 complete.
