-- Multi-week partner workshops: one events row with per-occurrence slots in JSON,
-- parallel external calendar id arrays, and booked session start on bookings.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS workshop_series text NOT NULL DEFAULT 'one_day'
    CHECK (workshop_series IN ('one_day', 'multi_week')),
  ADD COLUMN IF NOT EXISTS series_occurrences jsonb,
  ADD COLUMN IF NOT EXISTS series_google_calendar_event_ids jsonb,
  ADD COLUMN IF NOT EXISTS series_microsoft_outlook_event_ids jsonb;

COMMENT ON COLUMN public.events.workshop_series IS 'one_day: single session; multi_week: series_occurrences holds each weekly slot.';
COMMENT ON COLUMN public.events.series_occurrences IS 'multi_week only: JSON array of {start, max_attendees, available_slots}; start is ISO timestamptz.';
COMMENT ON COLUMN public.events.series_google_calendar_event_ids IS 'multi_week: JSON array of Google Calendar event ids (same order as series_occurrences).';
COMMENT ON COLUMN public.events.series_microsoft_outlook_event_ids IS 'multi_week: JSON array of Microsoft Graph event ids (same order as series_occurrences).';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS session_starts_at timestamptz;

COMMENT ON COLUMN public.bookings.session_starts_at IS 'For multi-week workshops: which occurrence was booked (matches series_occurrences[].start).';
