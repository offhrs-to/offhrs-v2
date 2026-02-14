-- Sync profile display_name and avatar_url from auth.users when user signs up or signs in (e.g. Google OAuth).
-- 1) On INSERT: upsert profile so we update if row already exists (e.g. from a previous attempt).
-- 2) On UPDATE: refresh profile from latest auth metadata so each login updates name/avatar.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, expertise_level, experience_points)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      (NEW.raw_user_meta_data->>'given_name') || ' ' || NULLIF(NEW.raw_user_meta_data->>'family_name', ''),
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    ),
    'Novice',
    0
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(NULLIF(trim(EXCLUDED.display_name), ''), profiles.display_name),
    avatar_url = COALESCE(NULLIF(trim(EXCLUDED.avatar_url), ''), profiles.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on UPDATE so that when auth.users is updated (e.g. on OAuth re-login), we refresh the profile.
CREATE OR REPLACE FUNCTION public.sync_profile_from_auth_metadata()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, expertise_level, experience_points)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      (NEW.raw_user_meta_data->>'given_name') || ' ' || NULLIF(trim(NEW.raw_user_meta_data->>'family_name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    COALESCE((SELECT expertise_level FROM public.profiles WHERE id = NEW.id), 'Novice'),
    COALESCE((SELECT experience_points FROM public.profiles WHERE id = NEW.id), 0)
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(trim((NEW.raw_user_meta_data->>'given_name') || ' ' || NULLIF(trim(NEW.raw_user_meta_data->>'family_name'), '')), ''),
      profiles.display_name,
      split_part(NEW.email, '@', 1)
    ),
    avatar_url = COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'avatar_url'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'picture'), ''),
      profiles.avatar_url
    ),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (
    OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data
    OR OLD.email IS DISTINCT FROM NEW.email
  )
  EXECUTE FUNCTION public.sync_profile_from_auth_metadata();

-- Backfill: ensure every auth.users row has a profile (e.g. users created before trigger or if trigger failed).
INSERT INTO public.profiles (id, display_name, avatar_url, expertise_level, experience_points)
SELECT
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    (u.raw_user_meta_data->>'given_name') || ' ' || NULLIF(trim(u.raw_user_meta_data->>'family_name'), ''),
    split_part(u.email, '@', 1)
  ),
  COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
  'Novice',
  0
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Update existing profiles that have empty display_name or avatar_url from auth.users (e.g. Google login that didn't sync).
UPDATE public.profiles p
SET
  display_name = COALESCE(
    NULLIF(trim(p.display_name), ''),
    NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
    NULLIF(trim((u.raw_user_meta_data->>'given_name') || ' ' || NULLIF(trim(u.raw_user_meta_data->>'family_name'), '')), ''),
    split_part(u.email, '@', 1)
  ),
  avatar_url = COALESCE(
    NULLIF(trim(p.avatar_url), ''),
    NULLIF(trim(u.raw_user_meta_data->>'avatar_url'), ''),
    NULLIF(trim(u.raw_user_meta_data->>'picture'), '')
  ),
  updated_at = NOW()
FROM auth.users u
WHERE u.id = p.id
  AND (
    (p.display_name IS NULL OR trim(p.display_name) = '')
    OR (p.avatar_url IS NULL OR trim(p.avatar_url) = '')
  );
