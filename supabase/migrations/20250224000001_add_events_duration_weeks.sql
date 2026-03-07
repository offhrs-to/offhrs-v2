-- Add duration_weeks to events: used for XP when attendees confirm (points = weeks per workshop).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'duration_weeks') THEN
      ALTER TABLE public.events ADD COLUMN duration_weeks INTEGER NOT NULL DEFAULT 1;
      COMMENT ON COLUMN public.events.duration_weeks IS 'Workshop length in weeks; used for experience points when user confirms attendance.';
    END IF;
  END IF;
END $$;
