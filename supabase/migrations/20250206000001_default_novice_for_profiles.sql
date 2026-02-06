-- Ensure all existing profiles have default Novice / 0 when not set (e.g. created before trigger set them).
UPDATE public.profiles
SET
  expertise_level = COALESCE(expertise_level, 'Novice'),
  experience_points = COALESCE(experience_points, 0)
WHERE expertise_level IS NULL OR experience_points IS NULL;
