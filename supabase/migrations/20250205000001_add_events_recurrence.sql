-- Add recurrence to events: 'none' (default), 'daily', or 'weekly'.
-- When daily/weekly, the event is treated as recurring and does not expire in workshop listings.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'recurrence') THEN
      ALTER TABLE public.events ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none';
      COMMENT ON COLUMN public.events.recurrence IS 'Recurring event: none (default), daily, or weekly. Daily/weekly events do not expire in listings.';
    END IF;
  END IF;
END $$;
