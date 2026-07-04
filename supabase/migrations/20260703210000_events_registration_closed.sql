ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_closed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.registration_closed IS
  'When true, workshop is hidden from consumer browse and no new bookings are accepted; existing bookings are kept.';
