-- ─────────────────────────────────────────────────────────────────────────────
-- Plain `status` column mirrored from `booking_status` (writable + trigger).
-- Avoids GENERATED columns (PostgREST inserts can conflict with GENERATED ALWAYS).
-- Canonical source remains `booking_status` (CHECK constraint); `status` stays in sync.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS status text;

UPDATE public.events e
SET status = e.booking_status
WHERE e.status IS NULL AND e.booking_status IS NOT NULL;

CREATE OR REPLACE FUNCTION public.events_sync_status_mirror()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.booking_status IS NOT NULL THEN
    NEW.status := NEW.booking_status;
  ELSIF NEW.status IS NOT NULL THEN
    NEW.booking_status := NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_sync_status_mirror ON public.events;
CREATE TRIGGER trg_events_sync_status_mirror
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE PROCEDURE public.events_sync_status_mirror();

NOTIFY pgrst, 'reload schema';
