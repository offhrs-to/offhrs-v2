-- Track every "Book" click (redirect to vendor) per event, including guests.
-- Admin "# of users redirected" = count of rows per event_id.
CREATE TABLE IF NOT EXISTS event_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_redirects_event_id ON event_redirects(event_id);

ALTER TABLE event_redirects ENABLE ROW LEVEL SECURITY;

-- Allow insert from app (anon or authenticated) for redirect tracking
CREATE POLICY "Allow insert for redirect tracking" ON event_redirects
  FOR INSERT WITH CHECK (true);

-- Backfill from existing bookings so admin counts include past redirects
INSERT INTO event_redirects (event_id, user_id, created_at)
SELECT event_id, user_id, created_at FROM bookings;
