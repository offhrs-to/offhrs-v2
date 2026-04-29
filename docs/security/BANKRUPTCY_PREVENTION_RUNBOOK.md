# Bankruptcy Prevention Runbook (Week 1)

This runbook is a practical, step-by-step setup to reduce the risk of runaway API costs and abuse-driven billing spikes.

## Scope

This plan focuses on five controls:

1. Budget alerts at 50%, 75%, 90%, 100% for each provider.
2. Hard monthly spend caps wherever providers support them.
3. Emergency kill switch env var and command path.
4. Daily quotas on expensive endpoints.
5. Pager alerts for abnormal traffic/cost events.

---

## 0) Ownership and Schedule (Day 0)

Assign owners before configuration work starts:

- **Primary operator:** person responsible for billing/security settings.
- **Backup operator:** secondary person for off-hours response.
- **On-call destination:** phone number and email for urgent alerts.

Set a 60-minute recurring weekly review:

- Check spend trends.
- Check alert noise vs. signal.
- Tune quotas and limits.

---

## 1) Budget Alerts and Hard Caps by Provider (Day 1)

Use this exact threshold policy for every provider:

- 50%: warning
- 75%: elevated warning
- 90%: urgent
- 100%: critical

### 1.1 Vercel

1. Open Vercel dashboard for the production team/project.
2. Go to Billing / Usage and configure spend alerts at 50/75/90/100%.
3. If your plan supports spend controls, set a hard spending limit.
4. Add two notification targets:
   - Primary operator email
   - Shared team mailbox (or backup operator)

### 1.2 Supabase

1. Open Supabase dashboard for production project.
2. Go to Billing / Usage.
3. Configure project spend alerts at 50/75/90/100%.
4. If available on your plan, set hard caps / spend controls.
5. Enable alerts for:
   - Database egress spikes
   - Auth traffic spikes
   - Function/compute spikes (if applicable)

### 1.3 Google Cloud (Maps API key usage)

1. Open Google Cloud Console (billing account tied to Maps usage).
2. Create budgets with thresholds 50/75/90/100%.
3. Configure alert channels:
   - Email
   - SMS/pager channel (via Cloud Monitoring notification channels)
4. Set quota limits per API:
   - Maps SDK for Android
   - Places/Geocoding APIs used by the app
5. Restrict keys to package + SHA fingerprints (already required security baseline).

### 1.4 Resend

1. Open Resend dashboard and review usage controls.
2. Configure plan usage alerts at 50/75/90/100% (if supported directly).
3. If threshold controls are limited, create external alerting using your own send metrics.
4. Add fallback email provider policy in incident runbook if Resend reaches limits.

### 1.5 Expo/EAS

1. Open Expo account/project billing usage.
2. Set usage notifications where available.
3. If hard caps are unavailable, enforce operational caps:
   - No automatic bulk build jobs without approval.
   - Weekly build count review.

### 1.6 GitHub Actions

1. Open repository/organization billing and Actions minutes usage.
2. Configure 50/75/90/100% usage alerts.
3. Add guardrails:
   - Avoid unbounded workflow triggers.
   - Restrict expensive jobs to `main` and manual dispatch where possible.

---

## 2) Emergency Kill Switch (Day 2)

Goal: disable expensive routes in minutes without redeploying code changes.

## 2.1 Env var policy

Define this env var in all relevant environments:

- `DISABLE_EXPENSIVE_ENDPOINTS=0` (normal state)
- Set to `1` during incident response.

Apply in:

- Vercel Production
- Vercel Preview (optional for testing)
- Local `.env.local` for runbook drills

## 2.2 Endpoint scope

Mark these as expensive/high-risk and subject to kill switch:

- `POST /api/scrape`
- `POST /api/book`
- `GET /api/confirm-attendance` (if attacked for token guessing)
- `POST /api/account/delete` (high-impact mutation)
- Cron/email fanout endpoints if abuse can trigger sends

## 2.3 Runtime behavior

When `DISABLE_EXPENSIVE_ENDPOINTS=1`:

- Return `503` with JSON body:
  - `{ "error": "Temporarily unavailable" }`
- Log a `[SECURITY_EVENT]` marker with route + reason.

## 2.4 Command path (incident)

1. Vercel → Project → Settings → Environment Variables.
2. Set `DISABLE_EXPENSIVE_ENDPOINTS=1` in Production.
3. Redeploy production immediately.
4. Confirm endpoints return `503`.
5. After incident, set back to `0` and redeploy.

---

## 3) Daily Quotas on Expensive Endpoints (Day 3)

Your current limiter is minute-based in-memory. Add daily ceilings to reduce worst-case monthly burn.

## 3.1 Daily quota targets (initial)

Use conservative defaults first, then tune:

- `POST /api/scrape`
  - 25/day per IP
  - 50/day per authenticated user
- `POST /api/book`
  - 75/day per IP
  - 200/day per authenticated user
- `POST /api/account/delete`
  - 3/day per user
  - 10/day per IP

## 3.2 Storage strategy

Do not rely only on in-memory quotas for production. Use shared storage:

- Preferred: Redis / Upstash / Vercel KV
- Fallback: Supabase quota table + RPC

## 3.3 Enforcement behavior

On daily limit reached:

- Return `429`
- Include `Retry-After` for next reset window
- Emit `[SECURITY_EVENT]` with route + subject key + quota name

---

## 4) Pager Alerts for Abnormal Volume (Day 4)

Set pager-backed alerting (not email-only) for incidents that can create cost spikes.

## 4.1 Alert conditions

Start with these thresholds:

- > 20 admin login failures from one key in 10 minutes
- > 100 scrape rate-limit hits in 10 minutes
- > 3x baseline request rate on `/api/book` in 15 minutes
- Any sustained attestation failure spike after enforcement is on
- Sudden jump in 5xx on security-sensitive endpoints

## 4.2 Alert routing

Primary:

- Pager app (PagerDuty/Opsgenie/etc.) or SMS channel

Secondary:

- Team email + Slack/Discord webhook

## 4.3 Triage playbook

On page trigger:

1. Identify route and source keys (IP/user pattern).
2. If cost risk is active, set `DISABLE_EXPENSIVE_ENDPOINTS=1`.
3. Apply temporary tighter rate/quotas for affected route.
4. Rotate compromised credentials if needed.
5. Post-incident review within 24 hours.

---

## 5) Weekly Verification Checklist (Day 5 and recurring)

Run every week:

- [ ] All provider alerts still active (50/75/90/100).
- [ ] Hard caps still enabled where available.
- [ ] Kill switch tested in preview/staging.
- [ ] Daily quotas triggered and logged as expected in test.
- [ ] Pager alerts fire and route correctly.
- [ ] Security event logs are searchable and retained.

---

## 6) Launch Gate

Before launch or major campaign:

- [ ] Budget alerts configured for all providers.
- [ ] Hard cap configured where possible.
- [ ] Emergency kill switch documented and tested.
- [ ] Daily quotas implemented for high-cost routes.
- [ ] Pager alerts live for abnormal volume.

If any box is unchecked, launch risk is elevated.
