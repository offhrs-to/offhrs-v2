# Launch Security Runbook

This runbook is the operational checklist for launch hardening.

## 1) Secret Rotation Policy

### Secret ownership matrix
| Secret | System | Primary owner | Backup owner |
| --- | --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Backend lead | DevOps lead |
| `ADMIN_PASSWORD` | Admin auth | Product owner | Backend lead |
| `ADMIN_API_SECRET` | Admin session signing | Backend lead | DevOps lead |
| `RESEND_API_KEY` | Email delivery | Backend lead | Product owner |
| Apple key material (`.p8`) | Apple OAuth / App Store | iOS release owner | Product owner |
| `GOOGLE_MAPS_API_KEY` | Android maps | Android release owner | Backend lead |

### Rotation cadence
- `SUPABASE_SERVICE_ROLE_KEY`: every 30 days, immediately on incident.
- `ADMIN_PASSWORD`: every 30 days, immediately on incident.
- `ADMIN_API_SECRET`: every 30 days, and every admin incident.
- `RESEND_API_KEY`: every 90 days.
- `APPLE_PRIVATE_KEY` / App Store key material: every 90 days.
- `GOOGLE_MAPS_API_KEY`: every 90 days and whenever key restrictions change.

### Required controls
- Always rotate in two steps: create new secret, deploy, then revoke old.
- Never reuse the same secret value.
- Track rotation date and owner in your internal ops notes.

### Admin incident response (exposed credential)
1. Generate new `ADMIN_PASSWORD`.
2. Generate new `ADMIN_API_SECRET`.
3. Deploy updated env vars.
4. Validate `/api/admin/session` returns `401` for old sessions.
5. Re-login and verify admin routes.

## 2) GitHub Hardening

### Required repository settings
- Private repo (or strict least-privilege access if public).
- Branch protection on `main`:
  - Require PR before merge.
  - Require at least 1 approving review.
  - Require status checks to pass (`Secret Scan`, `Environment Validation`).
  - Dismiss stale approvals on new commits.
  - Block force pushes and deletions.
- Organization-wide 2FA required.
- Least-privilege role assignments (no unnecessary admin permissions).

### Automation
- Use `scripts/security/apply-github-hardening.mjs` with a fine-grained PAT to set branch protection via GitHub API.

## 3) Secret Scanning in CI

Enabled via:
- `.github/workflows/secret-scan.yml` (Gitleaks)
- `.github/workflows/env-validation.yml` (required env validation)

## 4) Supabase RLS Verification

Run after migrations:
1. Confirm RLS enabled on:
   - `profiles`
   - `profile_category_experience`
   - `events`
   - `vendors`
   - `bookings`
   - `user_event_saves`
   - `vendor_reviews`
2. Validate anon can only read public tables (`events`, `vendors`, `vendor_reviews`).
3. Validate authenticated users can only mutate their own rows for user-owned tables.

## 5) Mobile Attestation Rollout

Sensitive routes now support optional attestation enforcement:
- `/api/book`
- `/api/account/delete`

Environment flags:
- `ENFORCE_MOBILE_ATTESTATION=1`
- `PLAY_INTEGRITY_VERIFY_URL` (Android verifier service)
- `APP_ATTEST_VERIFY_URL` (iOS verifier service)
- `MOBILE_ATTESTATION_SHARED_SECRET`

Recommended rollout:
1. Keep enforcement off (`ENFORCE_MOBILE_ATTESTATION=0`) while verifier is tested.
2. Ship clients that send:
   - `x-offhrs-platform: android|ios`
   - `x-offhrs-attestation-token: <token>`
3. Turn enforcement on for a small cohort.
4. Monitor error rates and rate-limited security events.
5. Roll out globally.

## 6) Security Monitoring

Server emits structured logs prefixed with `[SECURITY_EVENT]` for:
- Rate-limit violations.
- Admin login failures.
- Attestation failures.

Alerting recommendations:
- >20 admin login failures from one IP key in 10 minutes.
- >100 scrape rate-limit hits in 10 minutes.
- Any sustained attestation failure spike after enforcement is enabled.
