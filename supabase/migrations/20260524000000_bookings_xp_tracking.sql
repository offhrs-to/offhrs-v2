-- Track per-booking experience points so they can be awarded on confirmation
-- and clawed back on refund/cancellation.
--
-- xp_awarded_at IS NOT NULL  → XP is currently credited to the user for this booking.
-- xp_awarded_at IS NULL      → XP either never awarded, or already clawed back.
-- xp_amount                  → audit trail of how much was last awarded.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS xp_awarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS xp_amount integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_bookings_xp_awarded_at ON public.bookings(xp_awarded_at);

-- Backfill: any booking already marked attended has had XP given under the
-- legacy "credit at session end" flow. Record the assumed amount so a future
-- refund can still claw it back, and so the new flow doesn't double-award.
UPDATE public.bookings AS b
SET
  xp_awarded_at = COALESCE(b.created_at, now()),
  xp_amount = CASE
    WHEN e.workshop_series = 'multi_week'
      AND (e.partner_series_meta->>'pattern') IN ('weekly_same', 'weekly_custom')
      AND e.series_occurrences IS NOT NULL
      AND jsonb_typeof(e.series_occurrences) = 'array'
      AND jsonb_array_length(e.series_occurrences) > 0
    THEN GREATEST(1, jsonb_array_length(e.series_occurrences))
    ELSE GREATEST(1, COALESCE(e.duration_weeks, 1))
  END
FROM public.events AS e
WHERE b.event_id = e.id
  AND b.status = 'attended'
  AND b.xp_awarded_at IS NULL;

NOTIFY pgrst, 'reload schema';
