-- Per-category instructor flag: user is an "Instructor" for these categories (no level/progression bar).
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS instructor_categories TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.profiles.instructor_categories IS 'Categories in which the user is an instructor; they get special Instructor level with no progression bar for these.';
