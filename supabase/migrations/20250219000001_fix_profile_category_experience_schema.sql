-- Fix profile_category_experience table schema to use user_id instead of profile_id
-- This migration handles the case where the table was created with incorrect column names

DO $$
BEGIN
  -- Check if table exists with profile_id column (wrong schema)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'profile_category_experience' 
      AND column_name = 'profile_id'
  ) THEN
    -- Rename profile_id to user_id
    ALTER TABLE public.profile_category_experience 
    RENAME COLUMN profile_id TO user_id;
    
    -- Drop old policies that reference the old column name (if they exist)
    DROP POLICY IF EXISTS "Users can view their own category experience" ON public.profile_category_experience;
    DROP POLICY IF EXISTS "Users can insert their own category experience" ON public.profile_category_experience;
    DROP POLICY IF EXISTS "Users can update their own category experience" ON public.profile_category_experience;
    DROP POLICY IF EXISTS "Users can delete their own category experience" ON public.profile_category_experience;
  END IF;

  -- Ensure experience_points column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'profile_category_experience' 
      AND column_name = 'experience_points'
  ) THEN
    ALTER TABLE public.profile_category_experience
    ADD COLUMN experience_points INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- Ensure experience_years column is renamed or removed if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'profile_category_experience' 
      AND column_name = 'experience_years'
  ) THEN
    -- Drop experience_years if it exists (we use experience_points instead)
    ALTER TABLE public.profile_category_experience
    DROP COLUMN experience_years;
  END IF;

  -- Ensure expertise_level column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'profile_category_experience' 
      AND column_name = 'expertise_level'
  ) THEN
    ALTER TABLE public.profile_category_experience
    ADD COLUMN expertise_level TEXT NOT NULL DEFAULT 'Novice';
  END IF;

  -- Add constraint on expertise_level if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profile_category_experience_expertise_level_check'
  ) THEN
    ALTER TABLE public.profile_category_experience
    ADD CONSTRAINT profile_category_experience_expertise_level_check 
    CHECK (expertise_level IN ('Novice', 'Intermediate', 'Advanced', 'Expert', 'Master'));
  END IF;

END $$;

-- Now create the correct policies with user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profile_category_experience' 
      AND policyname = 'Users can view own category experience'
  ) THEN
    CREATE POLICY "Users can view own category experience"
      ON public.profile_category_experience
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profile_category_experience' 
      AND policyname = 'Users can insert own category experience'
  ) THEN
    CREATE POLICY "Users can insert own category experience"
      ON public.profile_category_experience
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profile_category_experience' 
      AND policyname = 'Users can update own category experience'
  ) THEN
    CREATE POLICY "Users can update own category experience"
      ON public.profile_category_experience
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profile_category_experience' 
      AND policyname = 'Users can delete own category experience'
  ) THEN
    CREATE POLICY "Users can delete own category experience"
      ON public.profile_category_experience
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
