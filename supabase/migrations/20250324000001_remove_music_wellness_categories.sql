-- Retire Music and Wellness from the product category set: remap events and clean profile data.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'events'
  ) THEN
    UPDATE public.events
    SET category = 'Other'
    WHERE category IN ('Music', 'Wellness');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profile_category_experience'
  ) THEN
    DELETE FROM public.profile_category_experience
    WHERE category IN ('Music', 'Wellness');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'instructor_categories'
  ) THEN
    UPDATE public.profiles
    SET instructor_categories = array_remove(array_remove(instructor_categories, 'Music'), 'Wellness')
    WHERE instructor_categories IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'category_of_interest'
  ) THEN
    UPDATE public.profiles
    SET category_of_interest = array_remove(array_remove(category_of_interest, 'Music'), 'Wellness')
    WHERE category_of_interest IS NOT NULL;
  END IF;
END $$;
