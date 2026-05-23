-- ─────────────────────────────────────────────────────────────────────────────
-- Ensure booking_status exists on events (idempotent).
-- Do NOT add a generated `status` column: PostgREST inserts can include it and
-- PostgreSQL rejects writes to GENERATED ALWAYS columns (see migration 08 if needed).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'booking_status'
  ) THEN
    ALTER TABLE public.events
      ADD COLUMN booking_status text NOT NULL DEFAULT 'published'
      CHECK (booking_status IN ('published','draft','fully_booked','archived'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
