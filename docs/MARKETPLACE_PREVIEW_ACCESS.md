# Preview / Deployment Protection (Marketplace testing)

Preview URLs like `*-offhrs-projects.vercel.app` may redirect to **Vercel Login (SSO)** when Deployment Protection is on. That is not an app bug — anonymous requests never reach Next.js.

## Open preview for partner testing

1. Vercel → **offhrs-v2** → **Settings** → **Deployment Protection**
2. Set protection so **Preview** is open (e.g. “Only Production” protected, or disable Preview protection), **or**
3. From the deployment page click **Visit** while logged into the Vercel team (SSO unlocks the preview), then go to `/partners/login`
4. Optional: create a **Shareable Link** / protection bypass for QA without SSO

Ensure Preview env has the same Supabase / Stripe keys as Production (Settings → Environment Variables → Preview checked).

## After SSO / open preview

1. `/partners/login` with your Lite/Pro test account  
2. Confirm **Marketplace** in the sidebar  
3. Complete Phase 1 shipping + product + QA steps (see plan checklist)
