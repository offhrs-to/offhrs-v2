-- Ensure profiles.instructor_categories exists (fixes "Could not find the 'instructor_categories' column" on mobile onboarding).
-- Idempotent: safe to run even if the column was added by 20250206000002_add_instructor_categories.sql.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'instructor_categories'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN instructor_categories TEXT[] DEFAULT NULL;
    COMMENT ON COLUMN public.profiles.instructor_categories IS 'Categories in which the user is an instructor; they get special Instructor level with no progression bar for these.';
  END IF;
END $$;
