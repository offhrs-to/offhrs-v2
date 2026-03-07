-- Track when the "confirm attendance" email was sent so cron does not send twice.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'confirmation_email_sent_at') THEN
      ALTER TABLE public.bookings ADD COLUMN confirmation_email_sent_at TIMESTAMPTZ NULL;
      COMMENT ON COLUMN public.bookings.confirmation_email_sent_at IS 'Set when the cron sends the confirm-attendance email (event_date + 24h).';
    END IF;
  END IF;
END $$;
