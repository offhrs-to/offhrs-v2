-- OAuth refresh tokens for Google Calendar / Microsoft Outlook (encrypted at rest in app layer).
-- External event ids on events for upsert/delete sync.

CREATE TABLE IF NOT EXISTS public.vendor_calendar_connections (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id               uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  provider                text NOT NULL CHECK (provider IN ('google', 'microsoft')),
  account_email           text,
  refresh_token_encrypted text NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_vendor_calendar_connections_vendor_id
  ON public.vendor_calendar_connections (vendor_id);

ALTER TABLE public.vendor_calendar_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_calendar_connections: service role all" ON public.vendor_calendar_connections;
CREATE POLICY "vendor_calendar_connections: service role all"
  ON public.vendor_calendar_connections FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS google_calendar_event_id   text,
  ADD COLUMN IF NOT EXISTS microsoft_outlook_event_id text;

COMMENT ON COLUMN public.events.google_calendar_event_id IS 'Google Calendar event id when synced via partner OAuth';
COMMENT ON COLUMN public.events.microsoft_outlook_event_id IS 'Microsoft Graph event id when synced via partner OAuth';

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS description text;
