-- Add author_name to vendor_reviews if missing (for existing installs)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_reviews' AND column_name = 'author_name') THEN
    ALTER TABLE vendor_reviews ADD COLUMN author_name TEXT;
  END IF;
END $$;

-- Fix: events might use INTEGER id - use generic FK (Supabase handles bigint/integer)
-- If events.id is bigint, the FK in bookings is correct. If integer, we need to alter.
-- Most Supabase/Postgres default serial is integer. Let's assume integer for compatibility.

-- Trigger to auto-create profile on user signup.
-- New users default to Novice in all categories with 0/10 progression unless they set years of experience in onboarding.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, expertise_level, experience_points)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'Novice',
    0
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill vendors from unique organizers in events
INSERT INTO vendors (name, slug)
SELECT orgs.organizer,
  COALESCE(NULLIF(trim(lower(regexp_replace(regexp_replace(orgs.organizer, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))), ''), orgs.organizer)
FROM (SELECT DISTINCT organizer FROM events WHERE organizer IS NOT NULL AND organizer != '') AS orgs
ON CONFLICT (name) DO NOTHING;

-- Update events with vendor_id based on organizer match
UPDATE events e
SET vendor_id = v.id
FROM vendors v
WHERE e.organizer = v.name
  AND e.vendor_id IS NULL;
