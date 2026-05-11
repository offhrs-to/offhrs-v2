-- ─────────────────────────────────────────────────────────────────────────────
-- Remove generated `events.status` from 20260508000007.
-- PostgREST may include that column in INSERT payloads; GENERATED ALWAYS rejects
-- any explicit value (even NULL), breaking inserts. Canonical column is booking_status.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.events DROP COLUMN IF EXISTS status;

NOTIFY pgrst, 'reload schema';
