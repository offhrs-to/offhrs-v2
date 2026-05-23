-- Per-event saves so "Saved" is exclusive to the event the user clicked (not all events from same vendor)
CREATE TABLE IF NOT EXISTS user_event_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_user_event_saves_user_id ON user_event_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_user_event_saves_event_id ON user_event_saves(event_id);

ALTER TABLE user_event_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own event saves" ON user_event_saves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own event saves" ON user_event_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own event saves" ON user_event_saves
  FOR DELETE USING (auth.uid() = user_id);
