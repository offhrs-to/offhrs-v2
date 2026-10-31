# After Shopify Sync App Store approval

Do this once Sync is approved (or review is clearly over). Until then, leave the lock **on**.

## Restore Lite / Pro / Marketplace

1. Vercel → project **offhrs-v2** → **Settings** → **Environment Variables**
2. Set `NEXT_PUBLIC_PARTNER_SIGNUP_SHOPIFY_SYNC_ONLY` = **`0`** for **Production** and **Preview**
3. **Redeploy** production (required — this is a `NEXT_PUBLIC_` build-time flag)
4. Confirm:
   - https://offhrs.app/partners — Lite/Pro/Marketplace CTAs live again
   - https://offhrs.app/partners/signup — plan picker shows all plans
   - Sync-only partner dashboard Overview — Marketplace + “View plans” cards return
   - Settings — “Lite & Pro (optional)” returns

Code default is also ON when the env var is unset — see `src/lib/partner-signup-plans.ts`.

## Optional cleanup

- Delete the unused August **offhrs** app in Dev Dashboard only after confirming client ID ≠ live Sync app
- Rotate any review passwords that were shared in listing notes
- Continue Marketplace smoke / mobile store release
