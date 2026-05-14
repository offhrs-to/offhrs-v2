-- Partner workshops: spots held on other platforms; optional JSON to round-trip schedule UI (e.g. daily weekdays).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS external_booked_count integer NOT NULL DEFAULT 0
    CHECK (external_booked_count >= 0);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS partner_series_meta jsonb;

COMMENT ON COLUMN public.events.external_booked_count IS
  'Per occurrence: seats already sold outside offhrs; subtracted from each slot''s available_slots (same max_attendees).';
COMMENT ON COLUMN public.events.partner_series_meta IS
  'Vendor dashboard: { "pattern": "weekly_same"|"weekly_custom"|"daily_weekdays", "daily_js_weekdays"?: [0-6] } for edit form.';
