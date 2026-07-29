-- Rename category label: Beauty & Fragrance → Scent & Candle (events, profiles, vendors).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'events'
  ) THEN
    UPDATE public.events
    SET category = 'Scent & Candle'
    WHERE category = 'Beauty & Fragrance';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profile_category_experience'
  ) THEN
    -- Rename when the user does not already have the new label (avoid unique conflicts).
    UPDATE public.profile_category_experience AS p
    SET category = 'Scent & Candle'
    WHERE p.category = 'Beauty & Fragrance'
      AND NOT EXISTS (
        SELECT 1
        FROM public.profile_category_experience AS x
        WHERE x.user_id = p.user_id
          AND x.category = 'Scent & Candle'
      );

    -- Drop any leftover legacy rows that could not be renamed.
    DELETE FROM public.profile_category_experience
    WHERE category = 'Beauty & Fragrance';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'instructor_categories'
  ) THEN
    UPDATE public.profiles
    SET instructor_categories = array_replace(instructor_categories, 'Beauty & Fragrance', 'Scent & Candle')
    WHERE instructor_categories IS NOT NULL
      AND instructor_categories @> ARRAY['Beauty & Fragrance']::text[];
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'category_of_interest'
  ) THEN
    UPDATE public.profiles
    SET category_of_interest = array_replace(category_of_interest, 'Beauty & Fragrance', 'Scent & Candle')
    WHERE category_of_interest IS NOT NULL
      AND category_of_interest @> ARRAY['Beauty & Fragrance']::text[];
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendor_profiles' AND column_name = 'category'
  ) THEN
    UPDATE public.vendor_profiles
    SET category = array_replace(category, 'Beauty & Fragrance', 'Scent & Candle')
    WHERE category IS NOT NULL
      AND category @> ARRAY['Beauty & Fragrance']::text[];
  END IF;
END $$;
